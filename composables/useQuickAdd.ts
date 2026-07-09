// Shared open/closed state for the global quick-add expense modal.
//
// The modal itself is hosted once, in layouts/default.vue, so it is reachable
// from every page. Any component (or the global "N" shortcut) can open it via
// this composable; `useState` keeps the ref shared across the whole app.
export function useQuickAdd() {
  const isOpen = useState<boolean>('quick-add-open', () => false)

  const open = () => {
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }

  return { isOpen, open, close }
}
