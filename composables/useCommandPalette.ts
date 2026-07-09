// Shared open/closed state for the command palette (ROADMAP §2, Ctrl+K).
//
// The palette itself is hosted once, in layouts/default.vue, so it is
// reachable from every page — same pattern as useQuickAdd. The global
// Ctrl/Cmd+K listener lives in the component; anything else (the dock, a
// hint chip) can open it through this composable.
export function useCommandPalette() {
  const isOpen = useState<boolean>('command-palette-open', () => false)

  const open = () => {
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }
  const toggle = () => {
    isOpen.value = !isOpen.value
  }

  return { isOpen, open, close, toggle }
}
