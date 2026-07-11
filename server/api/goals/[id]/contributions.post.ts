// POST /api/goals/:id/contributions
// Adds money to a goal by appending a row to its contributions ledger (rather
// than mutating a flat total). Returns the goal with freshly recomputed
// aggregates so the UI can update in one round-trip. Honours ?tz= so the
// returned thisMonthSaved matches the user's calendar month.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const goalId = getRouterParam(event, 'id')
  if (!goalId) {
    throw createError({ statusCode: 404, statusMessage: 'Savings goal not found.' })
  }

  // Confirm the goal exists AND belongs to this user before attaching money to
  // it — a missing or someone else's id 404s with no existence leak.
  const goal = await prisma.savingsGoal.findFirst({ where: { id: goalId, userId: user.id } })
  if (!goal) {
    throw createError({ statusCode: 404, statusMessage: 'Savings goal not found.' })
  }

  const input = parseContributionInput(await readBody(event))
  await prisma.savingsContribution.create({
    data: {
      userId: user.id,
      goalId: goal.id,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      date: new Date() // the money is put aside now
    }
  })

  const month = currentMonthRange(resolveTz(getQuery(event).tz))
  const [updated] = await goalsWithTotals(user.id, month, goal.id)
  setResponseStatus(event, 201)
  return updated
})
