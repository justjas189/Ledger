// GET /api/expenses/:id
// Fetches a single expense. The `[id]` in the filename is a route parameter.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  // findFirst (not findUnique) so we can filter by owner too: another user's
  // id resolves to null and 404s below — no cross-tenant reads, and we never
  // leak whether the id exists.
  const expense = await prisma.expense.findFirst({
    where: { id, userId: user.id },
    include: { category: true }
  })

  if (!expense) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }

  return serializeExpense(expense)
})
