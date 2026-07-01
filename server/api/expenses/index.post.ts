// POST /api/expenses
// Creates a new expense from the submitted form data.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  // 1. Read + validate the body. `parseExpenseInput` throws a 400 with
  //    per-field messages if anything is wrong, so we can trust `input` below.
  const body = await readBody(event)
  const input = parseExpenseInput(body)

  // 2. Make sure the chosen category really exists. This turns a confusing
  //    raw foreign-key database error into a friendly, specific message.
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

  // 3. Store it. Amount goes in as a Decimal fixed to 2 places (cents).
  const created = await prisma.expense.create({
    data: {
      description: input.description,
      amount: new Prisma.Decimal(input.amount.toFixed(2)),
      date: input.date,
      categoryId: input.categoryId
    },
    include: { category: true }
  })

  // 201 Created is the correct status for a successful POST that made a thing.
  setResponseStatus(event, 201)
  return serializeExpense(created)
})
