<script setup lang="ts">
// A slide-out panel, anchored to the right edge. Vaulted's replacement for
// the centered modal: forms and details slide IN beside the content instead
// of interrupting it, while the layout's "focus stage" scales and blurs the
// page behind (see composables/useFocusStage.ts).
//
// Handles the fiddly parts once so ExpenseForm doesn't have to:
//   • closes on Escape (topmost overlay only) and on clicking the backdrop
//   • locks page scroll while open
//   • traps Tab inside the panel, marks the page behind inert, and returns
//     focus to the opening control on close (see useFocusTrap)
//   • marks itself role="dialog" for screen readers
//   • acquires/releases the focus stage so the page behind reacts
import { X } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** Small line under the title, e.g. the current month. */
    subtitle?: string
  }>(),
  { title: '', subtitle: '' }
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = useId() // unique id linking the heading to the dialog
const { acquire, release } = useFocusStage()
// Focus trap: Tab stays inside, the page behind goes inert, Escape closes
// (only when this drawer is the top of the overlay stack — a confirmation
// dialog stacked above closes first), and focus returns to the trigger.
const trap = useFocusTrap(panel, () => emit('close'))

// `held` guards against double release (rapid toggles, unmount while open).
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
       mismatches, and a drawer only ever opens after user interaction. -->
  <ClientOnly>
    <Teleport to="body">
      <!-- Backdrop -->
      <Transition name="veil">
        <div
          v-if="open"
          class="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[2px] dark:bg-black/50"
          aria-hidden="true"
          @click="emit('close')"
        />
      </Transition>

      <!-- Panel -->
      <Transition name="drawer">
        <aside
          v-if="open"
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
          class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-black/5 bg-white/90 shadow-xl outline-none backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/90 sm:my-3 sm:mr-3 sm:max-h-[calc(100vh-1.5rem)] sm:rounded-2xl sm:border"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div>
              <h2 :id="titleId" class="font-display text-xl font-semibold tracking-tight text-ink">
                {{ title }}
              </h2>
              <p v-if="subtitle" class="mt-0.5 text-sm text-ink-faint">{{ subtitle }}</p>
            </div>
            <button
              type="button"
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 text-ink-soft transition-all duration-200 hover:rotate-90 hover:bg-black/5 hover:text-ink dark:border-white/15 dark:hover:bg-white/10"
              aria-label="Close drawer"
              @click="emit('close')"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div class="hairline shrink-0" />

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-6 py-5"><slot /></div>

          <!-- Optional footer -->
          <template v-if="$slots.footer">
            <div class="hairline shrink-0" />
            <div class="flex items-center justify-end gap-3 px-6 py-4">
              <slot name="footer" />
            </div>
          </template>
        </aside>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.veil-enter-active,
.veil-leave-active {
  transition: opacity 0.35s ease;
}
.veil-enter-from,
.veil-leave-to {
  opacity: 0;
}

/* The panel glides in with a springy settle, and leaves a touch faster. */
.drawer-enter-active {
  transition: transform 0.5s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.35s ease;
}
.drawer-leave-active {
  transition: transform 0.35s cubic-bezier(0.4, 0, 1, 1), opacity 0.3s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  transform: translateX(calc(100% + 1rem));
  opacity: 0.5;
}
</style>
