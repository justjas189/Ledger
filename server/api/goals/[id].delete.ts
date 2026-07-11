// DELETE /api/goals/:id
// Permanently removes a savings goal. The UI holds an Undo window before it
// ever calls this, so the deletion is deliberate by the time it lands.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  const existing = await prisma.savingsGoal.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Savings goal not found.' })
  }

  await prisma.savingsGoal.delete({ where: { id } })
  return { id, deleted: true }
})
