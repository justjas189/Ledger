// PUT /api/expenses/:id
// Updates an existing expense. PUT replaces all the editable fields, which
// matches our edit form (it submits every field), so it's the natural verb.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')

  // Confirm it exists first, so we can return a clean 404 rather than letting
  // the update throw a less-friendly database error.
  const existing = await prisma.expense.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Expense not found.' })
  }

  const body = await readBody(event)
  const input = parseExpenseInput(body)

  const category = await prisma.category.findUnique({
    where: { id: input.categoryId }
  })
  if (!category) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please fix the highlighted fields.',
      data: { fieldErrors: { categoryId: 'That category no longer exists.' } }
    })
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      description: input.description,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      date: input.date,
      categoryId: input.categoryId
    },
    include: { category: true }
  })

  return serializeExpense(updated)
})
