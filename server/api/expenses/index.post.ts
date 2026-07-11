// POST /api/expenses
// Creates a new expense from the submitted form data.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  // 0. Who's asking. 401s if there's no valid Supabase session.
  const user = await requireUser(event)

  // 1. Read + validate the body. `parseExpenseInput` throws a 400 with
  //    per-field messages if anything is wrong, so we can trust `input` below.
  const body = await readBody(event)
  const input = parseExpenseInput(body)

  // 2. Make sure the chosen category exists AND belongs to this user — nobody
  //    gets to attach their expense to someone else's category. Turns a raw
  //    foreign-key error into a friendly, specific message either way.
  const category = await prisma.category.findFirst({
    where: { id: input.categoryId, userId: user.id }
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
      userId: user.id,
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
