// Shared open/closed state for the monthly-budget editor (EditBudgetModal).
// The modal instance lives on pages/index.vue; this state lets other chrome
// (the account menu) open it from anywhere — mirroring useQuickAdd's shape.
export function useBudgetModal() {
  const isOpen = useState<boolean>('budget-modal-open', () => false)
  const open = () => {
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }
  return { isOpen, open, close }
}
