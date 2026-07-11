// Cache busting for the locked spending data.
//
// Four layers memoize /api/stats-derived numbers, and a mutation must reach
// all of them or the app keeps painting pre-mutation figures until a hard
// reload:
//   1. The 'stats' useFetch payload (dashboard + analytics). Its custom
//      getCachedData EXEMPTS it from Nuxt's unmount purge, so the payload
//      outlives the pages — and refreshNuxtData only reaches a MOUNTED
//      fetcher (it dispatches the app:data:refresh hook to live listeners,
//      never to a parked payload).
//   2. The 'expenses' list useFetch (default caching, purged on unmount —
//      only a mounted list needs the nudge).
//   3. The session-memoized forecast useState (see useForecast).
//   4. The shared 90-day pool (useExpenseHistory) that the streak chip,
//      anomalies, week-in-review and the forecast FALLBACK all read — without
//      this, the header streak sat frozen until a hard reload.
//
// Call after every successful expense mutation: add, edit, delete.
export async function refreshSpendingCaches() {
  const nuxtApp = useNuxtApp()

  // A mounted stats consumer refetches in place — data stays on screen while
  // pending, no flicker. With no consumer mounted, clear the parked payload
  // instead, so the next visit's getCachedData misses and fetches fresh.
  // (`_init` is true only while a component is actively using the key.)
  const keys = ['expenses']
  if (nuxtApp._asyncData['stats']?._init) {
    keys.push('stats')
  } else {
    clearNuxtData('stats')
  }

  // Force-refresh the pool alongside the payloads. `loaded` stays true and the
  // old rows stay in place while the re-page is in flight, so every derived
  // computed (streak, anomalies…) simply re-runs when the fresh rows land —
  // no flash, no unloaded state. If the pool's INITIAL load happens to be in
  // flight, load() drops the force (its loading guard) — acceptable: that
  // race needs a mutation within seconds of app start, and the pool converges
  // on the next mutation anyway.
  const { load: reloadHistory } = useExpenseHistory()

  await Promise.all([refreshNuxtData(keys), invalidateForecast(), reloadHistory(true)])
}
