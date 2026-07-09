// Seasonal budget forecast (ROADMAP §3, Feature 1 — server-side since unlock
// batch #1).
//
// The numbers now come from GET /api/stats/forecast, which runs the same
// weekday-means + day-of-month-spikes decomposition over the 90-day window
// but reduces it in one narrow SQL scan instead of shipping raw rows to the
// browser. The request carries the browser's IANA zone so "today", month
// boundaries, and day buckets match the user's calendar.
//
// The pre-unlock client computation is kept below as the fallback: if the
// endpoint fails (offline, server hiccup) we page the shared 90-day pool
// (useExpenseHistory) and decompose it here exactly as before. Either way the
// public signature is unchanged — `ready` / `forecastDays` / `projectedTotal`
// — and everything degrades gracefully: with little history the forecast
// simply reports itself not ready and the chart renders exactly as before.
//
// The fallback algorithm, step by step (the server mirrors this verbatim):
//   1. Zero-fill a daily-total series over the window (excluding today —
//      a half-logged day would drag its weekday's average down).
//   2. Weekday means — groceries cluster on Saturdays, commutes on weekdays;
//      the mean spend per weekday captures that weekly rhythm.
//   3. Recurring monthly spikes — for each day-of-month, look at how far that
//      day's totals sat ABOVE its weekday baseline in previous months. A day
//      that spikes consistently (rent on the 1st, a card bill on the 15th)
//      contributes its median spike to the same day of the current month.
//   4. Each remaining day of this month = its weekday mean + any spike due
//      that day. The dashed continuation on the trend chart and the projected
//      month-end total both come from this series.
import type { ForecastDay, ForecastResponse } from '~/types/expense'
import { HISTORY_DAYS } from './useExpenseHistory'

// Re-exported so chart components can keep importing the type from here.
export type { ForecastDay }

// The forecast needs at least two weeks of observed days before the weekday
// means say anything — below that, stay silent rather than guess.
const MIN_OBSERVED_DAYS = 14

// A day-of-month only counts as a recurring spike when we saw it at least
// twice and its median lift over the weekday baseline clears this floor —
// both an absolute floor (noise gate) and a multiple of the average day.
const MIN_SPIKE_SAMPLES = 2
const SPIKE_ABS_FLOOR = 20
const SPIKE_MEAN_MULTIPLE = 1.5

const EMPTY: ForecastResponse = { ready: false, days: [], projectedTotal: 0 }

/**
 * Cache-bust after an expense mutation (see refreshSpendingCaches): refetch
 * the session-memoized server forecast in place. The previous figures stay
 * visible until the fresh response lands — no "not ready" flash — and a
 * failed refetch keeps whatever is showing, same degradation as loadServer.
 */
export async function invalidateForecast() {
  if (!import.meta.client) return
  const serverForecast = useState<ForecastResponse | null>('forecast-server', () => null)
  const serverLoading = useState<boolean>('forecast-server-loading', () => false)
  // Nothing memoized yet (analytics not visited this session) → nothing
  // stale to bust; the first consumer's loadServer fetches fresh anyway.
  if (!serverForecast.value) return

  const serverFailed = useState<boolean>('forecast-server-failed', () => false)
  serverLoading.value = true
  try {
    serverForecast.value = await $fetch<ForecastResponse>('/api/stats/forecast', {
      query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
    })
    serverFailed.value = false
  } catch {
    // Endpoint unreachable — keep the pre-mutation figures on screen; they
    // beat an empty chart and converge on the next successful refresh.
  } finally {
    serverLoading.value = false
  }
}

function localDateKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function useForecast() {
  // Server result + status, shared across every consumer this session.
  const serverForecast = useState<ForecastResponse | null>('forecast-server', () => null)
  const serverFailed = useState<boolean>('forecast-server-failed', () => false)
  const serverLoading = useState<boolean>('forecast-server-loading', () => false)

  const { history, loaded, load } = useExpenseHistory()

  async function loadServer() {
    if (serverLoading.value || serverForecast.value || serverFailed.value) return
    serverLoading.value = true
    try {
      serverForecast.value = await $fetch<ForecastResponse>('/api/stats/forecast', {
        query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
      })
    } catch {
      // Endpoint unreachable — fall back to computing over the client pool.
      serverFailed.value = true
      load()
    } finally {
      serverLoading.value = false
    }
  }
  if (import.meta.client) loadServer()

  // --- Client fallback: the original pool-based computation ------------------
  const fallbackModel = computed<ForecastResponse>(() => {
    if (!loaded.value || history.value.length === 0) return EMPTY

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    // -- 1. Zero-filled daily totals, window start → yesterday ------------
    const totalsByKey = new Map<string, number>()
    for (const e of history.value) {
      const key = localDateKey(new Date(e.date))
      totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + e.amount)
    }

    const windowStart = new Date(today)
    windowStart.setDate(windowStart.getDate() - HISTORY_DAYS)

    type DayRow = { weekday: number; dayOfMonth: number; total: number }
    const series: DayRow[] = []
    for (let d = new Date(windowStart); d < today; d.setDate(d.getDate() + 1)) {
      series.push({
        weekday: d.getDay(),
        dayOfMonth: d.getDate(),
        total: totalsByKey.get(localDateKey(d)) ?? 0
      })
    }
    if (series.length < MIN_OBSERVED_DAYS) return EMPTY

    // -- 2. Weekday means --------------------------------------------------
    const weekdaySum = new Array(7).fill(0)
    const weekdayCount = new Array(7).fill(0)
    for (const row of series) {
      weekdaySum[row.weekday] += row.total
      weekdayCount[row.weekday] += 1
    }
    const weekdayMean = weekdaySum.map((sum, w) =>
      weekdayCount[w] > 0 ? sum / weekdayCount[w] : 0
    )
    const overallMean = series.reduce((a, r) => a + r.total, 0) / series.length

    // -- 3. Recurring day-of-month spikes (residual above weekday mean) ----
    const residualsByDom = new Map<number, number[]>()
    for (const row of series) {
      const residual = row.total - weekdayMean[row.weekday]
      const list = residualsByDom.get(row.dayOfMonth) ?? []
      list.push(residual)
      residualsByDom.set(row.dayOfMonth, list)
    }
    const spikeFloor = Math.max(SPIKE_ABS_FLOOR, SPIKE_MEAN_MULTIPLE * overallMean)
    const spikeByDom = new Map<number, number>()
    for (const [dom, residuals] of residualsByDom) {
      if (residuals.length < MIN_SPIKE_SAMPLES) continue
      const med = median(residuals)
      if (med > spikeFloor) spikeByDom.set(dom, med)
    }

    // -- 4. Expected spend for each remaining day of this month ------------
    const days: ForecastDay[] = []
    for (let dom = today.getDate() + 1; dom <= daysInMonth; dom++) {
      const date = new Date(now.getFullYear(), now.getMonth(), dom)
      const expected = Math.max(
        0,
        weekdayMean[date.getDay()] + (spikeByDom.get(dom) ?? 0)
      )
      days.push({ day: dom, expected })
    }

    // Month-to-date spend (today included) + the forecast remainder.
    const monthKey = localDateKey(today).slice(0, 7)
    let spentSoFar = 0
    for (const [key, total] of totalsByKey) {
      if (key.startsWith(monthKey) && key <= localDateKey(today)) spentSoFar += total
    }

    return {
      ready: days.length > 0,
      days,
      projectedTotal: spentSoFar + days.reduce((a, d) => a + d.expected, 0)
    }
  })

  // Server result when it arrived; fallback once the server has failed;
  // EMPTY (not ready) while the request is still in flight.
  const active = computed<ForecastResponse>(() =>
    serverForecast.value ?? (serverFailed.value ? fallbackModel.value : EMPTY)
  )

  return {
    ready: computed(() => active.value.ready),
    forecastDays: computed(() => active.value.days),
    projectedTotal: computed(() => active.value.projectedTotal)
  }
}
