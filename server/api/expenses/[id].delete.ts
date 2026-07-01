// DELETE /api/expenses/:id
// Permanently removes an expense (a "hard delete"). The UI always asks for
// confirmation before calling this, so the destructive action is deliberate.
//
// Alternative you could add later: a "soft delete" — add a `deletedAt` column
// and filter it out instead of removing the row, so nothing is ever truly lost.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }

  await prisma.expense.delete({ where: { id } })

  return { id, deleted: true }
})
