// GET /api/expenses/:id
// Fetches a single expense. The `[id]` in the filename is a route parameter.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { category: true }
  })

  if (!expense) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }

  return serializeExpense(expense)
})
