// A shared client-side pool of the last 90 days of expenses.
//
// The forecast (useForecast) and anomaly detection (useAnomalies) both need
// more history than the dashboard's 30-day trend provides, and the API is
// locked — so we page through the existing GET /api/expenses endpoint
// (pageSize is server-capped at 50) and keep the merged result in one shared
// `useState` list. Every consumer reuses the same fetch; nothing is loaded
// twice, and nothing runs on the server.
//
// The pool is a read-only analytical snapshot. It doesn't track optimistic
// mutations live, but refreshSpendingCaches() force-reloads it after every
// successful expense mutation, so pool-derived UI (the streak chip, anomalies,
// week-in-review, the forecast fallback) updates in place without a reload.
import type { ExpenseDTO, ExpenseListResponse } from '~/types/expense'

/** How far back the analytical window reaches. */
export const HISTORY_DAYS = 90

// Safety valve: 8 pages × 50 rows = 400 entries, plenty for a personal
// tracker's quarter and a hard stop against runaway loops.
const MAX_PAGES = 8

export function useExpenseHistory() {
  const history = useState<ExpenseDTO[]>('expense-history-90d', () => [])
  const loaded = useState<boolean>('expense-history-90d-loaded', () => false)
  const loading = useState<boolean>('expense-history-90d-loading', () => false)

  /** Local "yyyy-mm-dd" for the `from` query param (the API treats it inclusively). */
  function localDateKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /**
   * Fetch the window once (idempotent — safe to call from every consumer).
   * Failures degrade silently: the insight features simply stay hidden.
   */
  async function load(force = false) {
    if (import.meta.server) return
    if (loading.value || (loaded.value && !force)) return
    loading.value = true
    try {
      const from = new Date()
      from.setDate(from.getDate() - HISTORY_DAYS)

      const items: ExpenseDTO[] = []
      for (let page = 1; page <= MAX_PAGES; page++) {
        const res = await $fetch<ExpenseListResponse>('/api/expenses', {
          query: { page, pageSize: 50, from: localDateKey(from) }
        })
        items.push(...res.items)
        if (page >= res.totalPages) break
      }
      history.value = items
      loaded.value = true
    } catch {
      // Leave the pool as-is; forecast/anomalies just won't render this visit.
    } finally {
      loading.value = false
    }
  }

  return { history, loaded, loading, load }
}
