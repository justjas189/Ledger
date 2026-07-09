// Shared open/closed state for the month-end report card (ROADMAP §4).
//
// The card's modal is hosted once, in layouts/default.vue, so both the
// analytics-page button and the command palette can open it from anywhere.
export function useReportCard() {
  const isOpen = useState<boolean>('report-card-open', () => false)

  const open = () => {
    isOpen.value = true
  }
  const close = () => {
    isOpen.value = false
  }

  return { isOpen, open, close }
}
