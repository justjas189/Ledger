// PUT /api/goals/:id
// Edits the goal itself — rename, change the target, or move the deadline.
// PATCH-style: only the fields present in the body change; sending an
// explicit null CLEARS target/targetDate (targeted goal → open-ended fund),
// and setting a target converts a fund back into a goal. Adding money is a
// contribution (POST /api/goals/:id/contributions), not an edit here. Returns
// the goal with its recomputed aggregates.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  // Scope existence to the owner: another user's (or a missing) id 404s here
  // rather than being editable or leaking existence.
  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Savings goal not found.' })
  }

  const input = parseSavingsGoalUpdate(await readBody(event))

  // The deadline-requires-target invariant spans body + existing row, so check
  // the MERGED result (what the row would become) rather than the body alone.
  const nextTarget = input.target !== undefined ? input.target : existing.target
  const nextDate = input.targetDate !== undefined ? input.targetDate : existing.targetDate
  if (nextDate !== null && nextTarget === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please fix the highlighted fields.',
      data: { fieldErrors: { target: 'A deadline needs a target amount.' } }
    })
  }

  const data: Prisma.SavingsGoalUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.target !== undefined) {
    data.target = input.target !== null ? new Prisma.Decimal(input.target.toFixed(2)) : null
  }
  if (input.targetDate !== undefined) data.targetDate = input.targetDate
  await prisma.savingsGoal.update({ where: { id }, data })

  const month = currentMonthRange(resolveTz(getQuery(event).tz))
  const [updated] = await goalsWithTotals(user.id, month, existing.id)
  return updated
})
