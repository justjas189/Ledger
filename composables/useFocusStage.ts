// The "focus stage" effect: while any overlay (drawer, dialog) is open, the
// main page content behind it scales down slightly and blurs, pulling the
// eye to the overlay.
//
// Overlays call `acquire()` when they open and `release()` when they close;
// the layout watches `engaged` and applies the stage classes to <main>.
// A counter (not a boolean) so stacked overlays — e.g. a delete confirmation
// over the edit drawer — keep the stage dimmed until the LAST one closes.
export function useFocusStage() {
  const count = useState<number>('focus-stage-overlays', () => 0)

  const engaged = computed(() => count.value > 0)
  const acquire = () => {
    count.value++
  }
  const release = () => {
    count.value = Math.max(0, count.value - 1)
  }

  return { engaged, acquire, release }
}
