<script setup lang="ts">
// A reusable, accessible modal dialog.
// Handles the fiddly bits once so ExpenseForm and ConfirmDialog don't have to:
//   • closes on Escape and on clicking the dark backdrop
//   • locks page scroll while open
//   • moves keyboard focus into the dialog when it opens
//   • marks itself as role="dialog" for screen readers
const props = withDefaults(
  defineProps<{
    open: boolean
    title?: string
    /** Max width utility class, e.g. 'max-w-lg'. */
    maxWidth?: string
  }>(),
  { title: '', maxWidth: 'max-w-lg' }
)

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)
const titleId = useId() // unique id linking the heading to the dialog

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (isOpen) => {
    if (import.meta.server) return
    if (isOpen) {
      document.body.style.overflow = 'hidden' // stop the page behind scrolling
      window.addEventListener('keydown', onKeydown)
      nextTick(() => panel.value?.focus())
    } else {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKeydown)
    }
  }
)

// Safety net: make sure we never leave the listener/scroll-lock behind.
onBeforeUnmount(() => {
  if (import.meta.server) return
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
        @click.self="emit('close')"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
          class="w-full origin-bottom animate-scale-in rounded-t-2xl bg-panel shadow-card outline-none sm:rounded-2xl"
          :class="maxWidth"
        >
          <!-- Header -->
          <div
            v-if="title || $slots.header"
            class="flex items-center justify-between gap-4 border-b border-rule px-5 py-4 sm:px-6"
          >
            <slot name="header">
              <h2
                :id="titleId"
                class="font-display text-xl font-semibold text-ink"
              >
                {{ title }}
              </h2>
            </slot>
            <button
              type="button"
              class="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-ledger hover:text-ink"
              aria-label="Close dialog"
              @click="emit('close')"
            >
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="px-5 py-5 sm:px-6"><slot /></div>

          <!-- Optional footer -->
          <div
            v-if="$slots.footer"
            class="flex items-center justify-end gap-3 border-t border-rule px-5 py-4 sm:px-6"
          >
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
