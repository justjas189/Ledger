// Cache busting for the locked spending data.
//
// Three layers memoize /api/stats-derived numbers, and a mutation must reach
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

  await Promise.all([refreshNuxtData(keys), invalidateForecast()])
}
