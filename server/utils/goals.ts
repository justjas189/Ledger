// Savings-goal aggregation — the ledger math shared by the goals routes.
//
// The amount saved toward a goal isn't a stored column; it's the SUM of that
// goal's contributions. This computes two sums per goal in one place so GET
// /api/goals and POST /api/goals/:id/contributions return an identically shaped
// payload:
//   • totalSaved     — every contribution, all time
//   • thisMonthSaved — only contributions dated in the current calendar month
// The month window is timezone-aware (like the stats endpoints, unlock batch
// #1) so a user ahead of/behind the server sees the month THEY are in.
import type { SavingsGoalDTO } from '~/types/expense'

/** [start, end) UTC instants bounding the current calendar month in `tz`. */
export function currentMonthRange(tz: string | null): { start: Date; end: Date } {
  const now = new Date()
  const p = tz
    ? zonedParts(now, tz)
    : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }
  const start = tz ? zonedMidnightUtc(p.y, p.m, 1, tz) : new Date(p.y, p.m - 1, 1)
  const end = tz ? zonedMidnightUtc(p.y, p.m + 1, 1, tz) : new Date(p.y, p.m, 1)
  return { start, end }
}

/**
 * The user's goals with their contribution aggregates, oldest goal first. Pass
 * `goalId` to scope to a single goal (the contributions endpoint uses this to
 * return just the goal that changed). Every query is tenant-scoped by userId.
 */
export async function goalsWithTotals(
  userId: string,
  month: { start: Date; end: Date },
  goalId?: string
): Promise<SavingsGoalDTO[]> {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId, ...(goalId ? { id: goalId } : {}) },
    orderBy: { createdAt: 'asc' }
  })
  if (goals.length === 0) return []

  const ids = goals.map((g) => g.id)
  // Two grouped sums beat loading every contribution row into Node.
  const [totals, monthTotals] = await Promise.all([
    prisma.savingsContribution.groupBy({
      by: ['goalId'],
      _sum: { amount: true },
      where: { userId, goalId: { in: ids } }
    }),
    prisma.savingsContribution.groupBy({
      by: ['goalId'],
      _sum: { amount: true },
      where: { userId, goalId: { in: ids }, date: { gte: month.start, lt: month.end } }
    })
  ])
  const totalBy = new Map(totals.map((t) => [t.goalId, Number(t._sum.amount ?? 0)]))
  const monthBy = new Map(monthTotals.map((t) => [t.goalId, Number(t._sum.amount ?? 0)]))

  return goals.map((g) =>
    serializeSavingsGoal(g, {
      totalSaved: totalBy.get(g.id) ?? 0,
      thisMonthSaved: monthBy.get(g.id) ?? 0
    })
  )
}
