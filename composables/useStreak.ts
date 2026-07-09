// Logging streak (ROADMAP §4, Retention).
//
// The habit loop primitive: how many consecutive calendar days the user has
// logged at least one expense. Computed entirely from the shared 90-day
// client pool (useExpenseHistory) — no API changes, nothing stored.
//
// Rules, tuned to encourage rather than shame:
//   - Today counts when it has an entry, but an empty "today" does NOT break
//     the run — the user simply hasn't logged yet. The chain only breaks once
//     yesterday is also empty.
//   - The pool reaches back HISTORY_DAYS, so the count caps there; the header
//     renders that cap as "90+" instead of pretending precision.
import { HISTORY_DAYS } from './useExpenseHistory'

export function useStreak() {
  const { history, loaded, load } = useExpenseHistory()
  if (import.meta.client) load()

  function localDateKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const streak = computed(() => {
    if (!loaded.value) return 0

    const loggedDays = new Set<string>()
    for (const e of history.value) loggedDays.add(localDateKey(new Date(e.date)))

    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    // Grace period: an unlogged today starts the walk at yesterday instead.
    if (!loggedDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)

    let count = 0
    while (count < HISTORY_DAYS && loggedDays.has(localDateKey(cursor))) {
      count++
      cursor.setDate(cursor.getDate() - 1)
    }
    return count
  })

  /** True when the count hit the history window — the real streak may be longer. */
  const atCap = computed(() => streak.value >= HISTORY_DAYS)

  /** "12d" for the header chip; "90+d" at the window cap. */
  const label = computed(() => (atCap.value ? `${HISTORY_DAYS}+d` : `${streak.value}d`))

  /**
   * Peak header streak seen during a month ("YYYY-MM"): the longest logged
   * run ENDING on any of that month's days — runs are global, so one that
   * started last month keeps counting. The grace rule means the value shown
   * on the 1st can belong to a run that ended on the last day of the previous
   * month, so that day is scanned as an end-day too. Reads the same reactive
   * pool as `streak`, so callers inside computeds re-run when history loads.
   */
  function peakForMonth(monthKey: string): number {
    if (!loaded.value) return 0

    const loggedDays = new Set<string>()
    for (const e of history.value) loggedDays.add(localDateKey(new Date(e.date)))

    const monthStart = new Date(`${monthKey}-01T00:00:00`)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    monthEnd.setDate(0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const last = monthEnd < today ? monthEnd : today

    let peak = 0
    const cursor = new Date(monthStart)
    cursor.setDate(cursor.getDate() - 1) // grace: run visible on the 1st
    while (cursor <= last) {
      if (loggedDays.has(localDateKey(cursor))) {
        let run = 0
        const back = new Date(cursor)
        while (run < HISTORY_DAYS && loggedDays.has(localDateKey(back))) {
          run++
          back.setDate(back.getDate() - 1)
        }
        if (run > peak) peak = run
      }
      cursor.setDate(cursor.getDate() + 1)
    }
    return peak
  }

  return { streak, atCap, label, loaded, peakForMonth }
}
