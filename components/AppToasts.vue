<script setup lang="ts">
// Renders the stack of toast notifications above the dock.
// It reads the shared list from `useToast()` — any component that calls
// `useToast().success(...)` makes a message appear here.
// Toasts with an `action` (e.g. Undo on an optimistic delete) render the
// action as its own button beside the dismiss control.
import { Check, Info, TriangleAlert, X } from 'lucide-vue-next'
import type { Toast } from '~/composables/useToast'

const { toasts, dismiss } = useToast()

// Solid cards on a hairline border; only the icon carries the tone color.
const styles: Record<string, string> = {
  success: 'text-positive',
  error: 'text-negative',
  info: 'text-ink-soft'
}

const icons: Record<string, unknown> = {
  success: Check,
  error: TriangleAlert,
  info: Info
}

function runAction(t: Toast) {
  t.action?.onAction()
  dismiss(t.id)
}
</script>

<template>
  <!-- ClientOnly: teleporting to <body> during SSR causes hydration
       mismatches, and toasts only ever appear after user interaction. -->
  <ClientOnly>
    <Teleport to="body">
      <div
        class="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <TransitionGroup name="toast">
          <div
            v-for="t in toasts"
            :key="t.id"
            class="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-black/5 bg-white px-4 py-3 text-left text-sm font-medium shadow-lg dark:border-white/10 dark:bg-zinc-900"
            :class="styles[t.type]"
          >
            <component
              :is="icons[t.type]"
              class="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span class="flex-1 text-ink">{{ t.message }}</span>
            <button
              v-if="t.action"
              type="button"
              class="shrink-0 rounded-lg border border-black/10 px-2.5 py-1 font-mono text-xs font-semibold text-ink transition-colors duration-150 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              @click="runAction(t)"
            >
              {{ t.action.label }}
            </button>
            <button
              type="button"
              class="shrink-0 text-ink-faint transition-colors duration-150 hover:text-ink"
              aria-label="Dismiss notification"
              @click="dismiss(t.id)"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.96);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
