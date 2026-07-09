<script setup lang="ts">
// A small centered dialog. In Vaulted the drawer handles forms; this is
// kept for quick decisions (the delete confirmation) that deserve a hard
// interruption rather than a slide-in.
//   • closes on Escape (topmost overlay only) and on clicking the backdrop
//   • locks page scroll while open
//   • traps Tab inside the dialog, marks the page behind inert, and returns
//     focus to the opening control on close (see useFocusTrap)
//   • acquires/releases the focus stage so the page behind reacts
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** Max width utility class, e.g. 'max-w-lg'. */
    maxWidth?: string
  }>(),
  { title: '', maxWidth: 'max-w-md' }
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = useId() // unique id linking the heading to the dialog
const { acquire, release } = useFocusStage()
// Focus trap: Tab stays inside, the page behind goes inert, Escape closes
// (only when this dialog is the top of the overlay stack), and focus returns
// to the trigger on close.
const trap = useFocusTrap(panel, () => emit('close'))

let held = false
function engage() {
  if (held) return
  held = true
  acquire()
  document.body.style.overflow = 'hidden'
  trap.activate()
}
function disengage() {
  if (!held) return
  held = false
  release()
  document.body.style.overflow = ''
  trap.deactivate()
}

watch(
  () => props.open,
  (isOpen) => {
    if (import.meta.server) return
    isOpen ? engage() : disengage()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (import.meta.server) return
  disengage()
})
</script>

<template>
  <!-- ClientOnly: teleporting to <body> during SSR causes hydration
       mismatches, and a dialog only ever opens after user interaction. -->
  <ClientOnly>
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="open"
          class="fixed inset-0 z-[55] flex items-end justify-center overflow-y-auto bg-zinc-950/25 p-0 backdrop-blur-sm dark:bg-black/60 sm:items-center sm:p-6"
          @click.self="emit('close')"
        >
          <div
            ref="panel"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="title ? titleId : undefined"
            tabindex="-1"
            class="w-full origin-bottom animate-pop rounded-t-2xl border border-black/5 bg-white shadow-xl outline-none dark:border-white/10 dark:bg-zinc-900 sm:rounded-2xl"
            :class="maxWidth"
          >
            <!-- Header -->
            <div
              v-if="title || $slots.header"
              class="flex items-center justify-between gap-4 px-6 py-5"
            >
              <slot name="header">
                <h2 :id="titleId" class="font-display text-lg font-semibold tracking-tight text-ink">
                  {{ title }}
                </h2>
              </slot>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-full text-ink-soft transition-colors hover:bg-black/5 hover:text-ink dark:hover:bg-white/10"
                aria-label="Close dialog"
                @click="emit('close')"
              >
                <X class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <!-- Body -->
            <div class="px-6 pb-5"><slot /></div>

            <!-- Optional footer -->
            <div v-if="$slots.footer" class="flex items-center justify-end gap-3 px-6 pb-6">
              <slot name="footer" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
