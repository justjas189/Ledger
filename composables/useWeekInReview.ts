// Week-in-review (ROADMAP §4, Retention).
//
// The Monday reflection ritual: a dashboard card summarising the week that
// just ended — total spent, delta vs the week before, top category, and the
// single most unusual charge (reusing useAnomalies' MAD flags). Everything is
// derived from the shared 90-day client pool; the API stays untouched.
//
// Lifecycle: the card arrives on Monday and stays for the week until
// dismissed. Dismissal stores the week's Monday key in localStorage, so it
// returns naturally with the next week — a ritual, not a nag.
import type { CategoryDTO, ExpenseDTO } from '~/types/expense'

const DISMISS_KEY = 'vaulted-week-review-dismissed'

export interface WeekReviewTopCategory {
  category: CategoryDTO | null
  total: number
}

export interface WeekReviewAnomaly {
  description: string
  amount: number
  date: string
  /** How many MADs above the category's typical entry (see useAnomalies). */
  score: number
}

export function useWeekInReview() {
  const { history, loaded, load } = useExpenseHistory()
  const { anomalyFor } = useAnomalies()
  if (import.meta.client) load()

  function localDateKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Monday of the CURRENT week — the card's identity. The review covers the
  // seven days before it (last Monday → last Sunday).
  function currentMonday(): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // getDay(): Sun=0 … Sat=6
    return d
  }

  // --- Dismissal (per-week, localStorage) --------------------------------
  const dismissed = useState<boolean>('week-review-dismissed', () => false)
  if (import.meta.client) {
    try {
      dismissed.value = localStorage.getItem(DISMISS_KEY) === localDateKey(currentMonday())
    } catch {
      // Blocked storage: the card just reappears next visit.
    }
  }
  function dismiss() {
    dismissed.value = true
    if (import.meta.client) {
      try {
        localStorage.setItem(DISMISS_KEY, localDateKey(currentMonday()))
      } catch {
        // Session-only dismissal is fine.
      }
    }
  }

  // --- The review itself --------------------------------------------------
  const review = computed(() => {
    const empty = {
      ready: false,
      weekLabel: '',
      total: 0,
      priorTotal: 0,
      deltaPct: null as number | null,
      topCategory: null as WeekReviewTopCategory | null,
      anomaly: null as WeekReviewAnomaly | null
    }
    if (!loaded.value) return empty

    const monday = currentMonday()
    const weekStart = new Date(monday)
    weekStart.setDate(weekStart.getDate() - 7)
    const priorStart = new Date(monday)
    priorStart.setDate(priorStart.getDate() - 14)

    const startKey = localDateKey(weekStart)
    const endKey = localDateKey(monday) // exclusive
    const priorKey = localDateKey(priorStart)

    const week: ExpenseDTO[] = []
    let priorTotal = 0
    for (const e of history.value) {
      const key = localDateKey(new Date(e.date))
      if (key >= startKey && key < endKey) week.push(e)
      else if (key >= priorKey && key < startKey) priorTotal += e.amount
    }
    // Nothing logged last week: stay silent rather than shame an empty week.
    if (week.length === 0) return empty

    const total = week.reduce((a, e) => a + e.amount, 0)

    // Top category of the week, carrying the CategoryDTO for the pill.
    const byCategory = new Map<string, WeekReviewTopCategory>()
    for (const e of week) {
      const row = byCategory.get(e.categoryId) ?? { category: e.category, total: 0 }
      row.total += e.amount
      byCategory.set(e.categoryId, row)
    }
    let topCategory: WeekReviewTopCategory | null = null
    for (const row of byCategory.values()) {
      if (!topCategory || row.total > topCategory.total) topCategory = row
    }

    // The single most unusual charge of the week (highest MAD score), if any.
    let anomaly: WeekReviewAnomaly | null = null
    for (const e of week) {
      const flag = anomalyFor(e)
      if (flag && (!anomaly || flag.score > anomaly.score)) {
        anomaly = { description: e.description, amount: e.amount, date: e.date, score: flag.score }
      }
    }

    const sunday = new Date(monday)
    sunday.setDate(sunday.getDate() - 1)
    const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
    const weekLabel = `${fmt.format(weekStart)} – ${fmt.format(sunday)}`

    return {
      ready: true,
      weekLabel,
      total,
      priorTotal,
      deltaPct: priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : null,
      topCategory,
      anomaly
    }
  })

  const visible = computed(() => review.value.ready && !dismissed.value)

  return { review, visible, dismiss }
}
