// Shared `prefers-reduced-motion` state for JS-driven animation.
//
// CSS motion is already gated globally (see the media query in main.css that
// zeroes animation/transition durations). This composable is the same gate
// for animations driven from script — count-ups, rAF loops, programmatic
// tweens — which CSS can't reach. It tracks the live media query, so flipping
// the OS setting mid-session takes effect without a reload.
//
// SSR renders with `false`; the first client call syncs the real value before
// any animation starts (client-only pages fetch with server:false anyway).

// Bind the media-query listener once per app, not once per caller.
let bound = false

export function useReducedMotion() {
  const reduced = useState<boolean>('prefers-reduced-motion', () => false)

  if (import.meta.client && !bound) {
    bound = true
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = mq.matches
    mq.addEventListener('change', (e) => {
      reduced.value = e.matches
    })
  }

  return reduced
}
