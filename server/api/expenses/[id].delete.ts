// DELETE /api/expenses/:id
// Permanently removes an expense (a "hard delete"). The UI always asks for
// confirmation before calling this, so the destructive action is deliberate.
//
// Alternative you could add later: a "soft delete" — add a `deletedAt` column
// and filter it out instead of removing the row, so nothing is ever truly lost.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  // Scope the existence check to the owner: another user's id 404s here
  // instead of being deletable.
  const existing = await prisma.expense.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }

  await prisma.expense.delete({ where: { id } })

  return { id, deleted: true }
})
