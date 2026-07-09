// Nudge budget limitation (ROADMAP §4, Retention).
//
// Guardian features die by spam. This queue gathers every nudge-worthy
// signal, ranks by severity, and speaks AT MOST ONCE PER DAY — the single
// most severe item only. localStorage remembers the last day a nudge was
// shown; a session-wide guard stops re-evaluation on every navigation.
//
// The anomaly digest toast that used to live in useAnomalies is absorbed
// here as the lowest rung: it was the app's first nudge, and two competing
// guardian toasts is exactly the spam this item exists to prevent.
//
// Severity ladder (highest wins):
//   3 — a category has blown past its monthly budget (worst overshoot picked)
//   2 — the month's straight-line pace exceeds income or the total budget
//   1 — unusually large charges landed this month (the old digest, verbatim)
import type { StatsResponse } from '~/types/expense'

const SHOWN_KEY = 'vaulted-nudge-last-shown'

interface Nudge {
  severity: number
  message: string
}

export function useNudges(stats: Readonly<Ref<StatsResponse | null | undefined>>) {
  const { history, loaded: historyLoaded } = useExpenseHistory()
  const { anomalyFor } = useAnomalies()
  const { formatMoney } = useFormatters()
  const toast = useToast()

  // Once per session: the dashboard remounts on every visit, but the queue
  // only ever weighs in on the first fully-loaded one.
  const evaluated = useState<boolean>('nudges-evaluated', () => false)

  function localDateKey(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function candidates(s: StatsResponse): Nudge[] {
    const out: Nudge[] = []

    // 3 — the category furthest past its budget.
    let worst: { name: string; overPct: number } | null = null
    for (const b of s.budgets) {
      if (b.budget <= 0 || b.spent <= b.budget) continue
      const overPct = ((b.spent - b.budget) / b.budget) * 100
      if (!worst || overPct > worst.overPct) worst = { name: b.name, overPct }
    }
    if (worst) {
      out.push({
        severity: 3,
        message: `${worst.name} is ${worst.overPct.toFixed(0)}% over its monthly budget — worth a look.`
      })
    }

    // 2 — the month is pacing past income or the total budget.
    if (s.paceOverLimit) {
      const limit = s.projectedMonthTotal > s.monthlyIncome ? 'income' : 'budget'
      out.push({
        severity: 2,
        message: `On pace for ${formatMoney(s.projectedMonthTotal)} this month — that's past your ${limit}.`
      })
    }

    // 1 — this month's anomaly digest (moved here from useAnomalies).
    const monthKey = new Date().toISOString().slice(0, 7)
    const flagged = history.value.filter(
      (e) => e.date.startsWith(monthKey) && anomalyFor(e)
    ).length
    if (flagged > 0) {
      out.push({
        severity: 1,
        message: `${flagged} unusually large ${flagged === 1 ? 'charge' : 'charges'} this month — look for the amber pills.`
      })
    }

    return out
  }

  function evaluate() {
    if (!import.meta.client || evaluated.value) return
    const s = stats.value
    // Wait until BOTH sources are in, so the ranking sees every candidate.
    if (!s || !historyLoaded.value) return
    evaluated.value = true

    const today = localDateKey(new Date())
    try {
      if (localStorage.getItem(SHOWN_KEY) === today) return
    } catch {
      // No storage means no daily cap — stay silent rather than risk spam.
      return
    }

    const all = candidates(s)
    if (all.length === 0) return
    const top = all.sort((a, b) => b.severity - a.severity)[0]
    toast.info(top.message, { duration: 8000 })
    try {
      localStorage.setItem(SHOWN_KEY, today)
    } catch {
      // Checked above; kept for symmetry.
    }
  }

  watch([stats, historyLoaded], () => evaluate(), { immediate: true })
}
