// Savings goals (ROADMAP §4, Retention).
//
// Positive framing: targets to fill rather than ceilings to fear. Goals live in
// Postgres (model SavingsGoal), owned by the signed-in user. The amount saved
// is no longer a flat column — it's the SUM of a contributions ledger
// (SavingsContribution), aggregated server-side into totalSaved +
// thisMonthSaved so we can show month-to-month progress. Adding money appends a
// ledger row via POST /api/goals/:id/contributions. Amounts are BASE USD (the
// dialogs enter them in the active display currency and convert).
import type { SavingsGoalDTO } from '~/types/expense'

const round2 = (n: number) => Math.round(n * 100) / 100

/** The browser's IANA zone, so "this month" aggregates match the user's calendar. */
function clientTz(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

export function useSavingsGoals() {
  const goals = useState<SavingsGoalDTO[]>('savings-goals', () => [])
  const loaded = useState<boolean>('savings-goals-loaded', () => false)
  const pending = useState<boolean>('savings-goals-pending', () => false)

  /** Fetch the user's goals + aggregates. Idempotent; pass force after a change. */
  async function load(force = false) {
    if (!import.meta.client || (loaded.value && !force)) return
    pending.value = true
    try {
      goals.value = await $fetch<SavingsGoalDTO[]>('/api/goals', { query: { tz: clientTz() } })
      loaded.value = true
    } finally {
      pending.value = false
    }
  }

  /**
   * Create a savings bucket. Pass `goal` (BASE USD target + yyyy-mm-dd
   * deadline) for a targeted goal; omit it for an open-ended fund (e.g.
   * "Emergency Fund") — same ledger, no finish line.
   */
  async function addGoal(
    name: string,
    goal?: { target: number; targetDate: string }
  ): Promise<SavingsGoalDTO> {
    const created = await $fetch<SavingsGoalDTO>('/api/goals', {
      method: 'POST',
      body: {
        name: name.trim().slice(0, 60),
        target: goal ? round2(goal.target) : null,
        targetDate: goal ? goal.targetDate : null
      }
    })
    goals.value = [...goals.value, created]
    return created
  }

  /**
   * Add money to a goal — appends a contribution and returns the goal with
   * refreshed aggregates. `amount` is BASE USD.
   */
  async function contribute(goalId: string, amount: number): Promise<SavingsGoalDTO> {
    const updated = await $fetch<SavingsGoalDTO>(`/api/goals/${goalId}/contributions`, {
      method: 'POST',
      query: { tz: clientTz() },
      body: { amount: round2(amount) }
    })
    goals.value = goals.value.map((g) => (g.id === goalId ? updated : g))
    // A contribution moves money into savings, which changes this month's
    // thisMonthSaved → Safe to Spend, Savings rate and the spending pace on the
    // dashboard. The dashboard reads /api/stats under the 'stats' key, so
    // invalidate it here and let its useFetch re-run — no parent wiring, the
    // headline tiles update without a page reload.
    await refreshNuxtData('stats')
    return updated
  }

  /** Permanently delete a goal (its contributions cascade). Card holds an Undo. */
  async function removeGoal(id: string) {
    await $fetch(`/api/goals/${id}`, { method: 'DELETE' })
    goals.value = goals.value.filter((g) => g.id !== id)
    // Deleting a goal cascades its contributions away, so this month's savings
    // total drops — refresh the dashboard stats for the same reason as above.
    await refreshNuxtData('stats')
  }

  return { goals, loaded, pending, load, addGoal, contribute, removeGoal }
}
