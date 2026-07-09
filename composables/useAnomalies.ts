// Spending anomaly detection (ROADMAP §3, Feature 3).
//
// Charts show where money went; this flags the entries that *shouldn't* have
// been that big. For every category we compute the mean entry amount and the
// MAD (Mean Absolute Deviation — the average distance from that mean) over
// the shared 90-day history. An entry sitting more than 3 MADs above its
// category's mean is flagged.
//
// Surfacing is deliberately quiet: a small amber pill on the expense row
// (rendered by ExpenseTable). The month's digest toast moved into the daily
// nudge queue (useNudges) so guardian messages never stack up — active
// guardian, not a nag.
import type { ExpenseDTO } from '~/types/expense'

/** Everything the pill's tooltip needs to justify the flag. */
export interface AnomalyFlag {
  /** Category's typical (mean) entry over the last 90 days. */
  mean: number
  /** Mean Absolute Deviation of those entries. */
  mad: number
  /** How many MADs above the mean this entry sits (always > threshold). */
  score: number
}

// Below this many entries the category "typical" is too shaky to accuse
// anything of being unusual.
const MIN_SAMPLES = 6
/** An entry is anomalous when it sits more than this many MADs above the mean. */
export const ANOMALY_MAD_THRESHOLD = 3

export function useAnomalies() {
  const { history, loaded, load } = useExpenseHistory()
  if (import.meta.client) load()

  // Per-category { mean, mad, n } over the 90-day pool.
  const statsByCategory = computed(() => {
    const amounts = new Map<string, number[]>()
    for (const e of history.value) {
      const list = amounts.get(e.categoryId) ?? []
      list.push(e.amount)
      amounts.set(e.categoryId, list)
    }
    const out = new Map<string, { mean: number; mad: number; n: number }>()
    for (const [categoryId, list] of amounts) {
      const n = list.length
      const mean = list.reduce((a, b) => a + b, 0) / n
      const mad = list.reduce((a, b) => a + Math.abs(b - mean), 0) / n
      out.set(categoryId, { mean, mad, n })
    }
    return out
  })

  /**
   * Returns the flag when the entry is unusually large for its category,
   * null otherwise. Works for optimistic rows too — they carry the same
   * shape the table renders.
   */
  function anomalyFor(e: Pick<ExpenseDTO, 'amount' | 'categoryId'>): AnomalyFlag | null {
    const s = statsByCategory.value.get(e.categoryId)
    if (!s || s.n < MIN_SAMPLES || s.mad <= 0) return null
    const score = (e.amount - s.mean) / s.mad
    if (score <= ANOMALY_MAD_THRESHOLD) return null
    return { mean: s.mean, mad: s.mad, score }
  }

  return { anomalyFor, loaded }
}
