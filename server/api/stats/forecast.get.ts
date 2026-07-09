// GET /api/stats/forecast?tz=<IANA zone>
// Seasonal month-end forecast (unlock batch #1) — the server-side port of
// composables/useForecast.ts. Same algorithm, same constants, same response
// shape, so the client can swap over without any component changes:
//
//   1. Zero-fill a daily-total series over the last 90 days (excluding today —
//      a half-logged day would drag its weekday's average down).
//   2. Weekday means capture the weekly rhythm (groceries cluster on
//      Saturdays, commutes on weekdays).
//   3. Recurring day-of-month spikes: days whose totals sit consistently
//      ABOVE their weekday baseline (rent on the 1st, a card bill on the
//      15th) contribute their median lift to the same day this month.
//   4. Each remaining day of the month = its weekday mean + any spike due.
//
// The server advantage over the client version: one narrow SQL scan reduced
// to ~90 daily totals here, instead of shipping 90 days of raw rows to every
// browser. Day bucketing honours the same optional `tz` param as /api/stats —
// without it, calendar math falls back to the server's zone.
import type { ForecastDay, ForecastResponse } from '~/types/expense'

/** Window length — mirrors HISTORY_DAYS in composables/useExpenseHistory.ts. */
const HISTORY_DAYS = 90

// Thresholds mirror composables/useForecast.ts verbatim — the two
// implementations must agree so the client fallback is indistinguishable.
const MIN_OBSERVED_DAYS = 14
const MIN_SPIKE_SAMPLES = 2
const SPIKE_ABS_FLOOR = 20
const SPIKE_MEAN_MULTIPLE = 1.5

const EMPTY: ForecastResponse = { ready: false, days: [], projectedTotal: 0 }

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default defineEventHandler(async (event): Promise<ForecastResponse> => {
  const tz = resolveTz(getQuery(event).tz)

  // Where "now" sits on the calendar (m is 1-based), matching /api/stats.
  const now = new Date()
  const p = tz
    ? zonedParts(now, tz)
    : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }

  // One narrow query: (date, amount) pairs from the window start onward.
  // No upper bound — today's rows are needed for the month-to-date figure
  // even though they're excluded from the observed series below.
  const windowStart = tz
    ? zonedMidnightUtc(p.y, p.m, p.d - HISTORY_DAYS, tz)
    : new Date(p.y, p.m - 1, p.d - HISTORY_DAYS)
  const rows = await prisma.expense.findMany({
    select: { date: true, amount: true },
    where: { date: { gte: windowStart } }
  })
  if (rows.length === 0) return EMPTY

  // -- 1. Daily totals keyed by the calendar day the user experienced --------
  const dateKey = (date: Date) => {
    if (tz) return zonedDateKey(date, tz)
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  }
  const totalsByKey = new Map<string, number>()
  for (const row of rows) {
    const key = dateKey(row.date)
    totalsByKey.set(key, (totalsByKey.get(key) ?? 0) + Number(row.amount))
  }

  // Zero-filled series over the 90 wall-calendar days before today. A
  // UTC-anchored Date is just a calendar carrier (no zone conversion), so
  // the same walk serves both the tz and the legacy path.
  type DayRow = { weekday: number; dayOfMonth: number; total: number }
  const series: DayRow[] = []
  const cursor = new Date(Date.UTC(p.y, p.m - 1, p.d - HISTORY_DAYS))
  for (let i = 0; i < HISTORY_DAYS; i++) {
    series.push({
      weekday: cursor.getUTCDay(),
      dayOfMonth: cursor.getUTCDate(),
      total: totalsByKey.get(cursor.toISOString().slice(0, 10)) ?? 0
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  if (series.length < MIN_OBSERVED_DAYS) return EMPTY

  // -- 2. Weekday means --------------------------------------------------------
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

  // -- 3. Recurring day-of-month spikes (residual above weekday mean) ----------
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

  // -- 4. Expected spend for each remaining day of this month ------------------
  const daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()
  const days: ForecastDay[] = []
  for (let dom = p.d + 1; dom <= daysInMonth; dom++) {
    const weekday = new Date(Date.UTC(p.y, p.m - 1, dom)).getUTCDay()
    const expected = Math.max(0, weekdayMean[weekday] + (spikeByDom.get(dom) ?? 0))
    days.push({ day: dom, expected })
  }

  // Month-to-date spend (today included) + the forecast remainder.
  const monthKey = `${p.y}-${pad2(p.m)}`
  const todayKey = `${monthKey}-${pad2(p.d)}`
  let spentSoFar = 0
  for (const [key, total] of totalsByKey) {
    if (key.startsWith(monthKey) && key <= todayKey) spentSoFar += total
  }

  return {
    ready: days.length > 0,
    days,
    projectedTotal: spentSoFar + days.reduce((a, d) => a + d.expected, 0)
  }
})
