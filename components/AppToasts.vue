<script setup lang="ts">
// Renders the stack of toast notifications in the corner of the screen.
// It reads the shared list from `useToast()` — any component that calls
// `useToast().success(...)` makes a message appear here.
const { toasts, dismiss } = useToast()

const styles: Record<string, string> = {
  success: 'border-pine/30 bg-pine text-white',
  error: 'border-clay/30 bg-clay text-white',
  info: 'border-rule bg-ink text-white'
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      aria-live="polite"
      aria-atomic="true"
    >
      <TransitionGroup name="toast">
        <button
          v-for="t in toasts"
          :key="t.id"
          type="button"
          class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium shadow-card"
          :class="styles[t.type]"
          @click="dismiss(t.id)"
        >
          <span aria-hidden="true">{{ t.type === 'error' ? '⚠' : '✓' }}</span>
          <span class="flex-1">{{ t.message }}</span>
          <span class="text-white/60" aria-hidden="true">✕</span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
