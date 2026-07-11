// Eased count-up for numeric displays (hero figure, metric tiles).
//
// Watches a numeric source and tweens the returned ref toward each new value
// with an ease-out quart — the same curve the dashboard hero has always used.
// Re-targets from the CURRENT displayed value (not zero), so a stats refresh
// glides instead of restarting. Under prefers-reduced-motion (via
// useReducedMotion) or on the server it snaps straight to the target.
export function useCountUp(source: () => number | null | undefined, duration = 1100) {
  const reducedMotion = useReducedMotion()
  const display = ref(0)

  let raf = 0
  let settle: ReturnType<typeof setTimeout> | undefined

  function cancel() {
    if (raf) cancelAnimationFrame(raf)
    if (settle) clearTimeout(settle)
    raf = 0
    settle = undefined
  }

  function run(target: number) {
    cancel()
    if (import.meta.server || reducedMotion.value) {
      display.value = target
      return
    }
    const from = display.value
    const startTime = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      const eased = 1 - Math.pow(1 - t, 4) // ease-out quart
      display.value = from + (target - from) * eased
      if (t < 1) raf = requestAnimationFrame(step)
      else display.value = target
    }
    raf = requestAnimationFrame(step)
    // Safety net: browsers throttle rAF in background/hidden tabs, which would
    // strand the figure mid-count — always land on the target.
    settle = setTimeout(() => {
      cancel()
      display.value = target
    }, duration + 200)
  }

  watch(() => source() ?? 0, run, { immediate: true })
  onScopeDispose(cancel)

  return display
}
