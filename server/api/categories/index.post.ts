// POST /api/categories
// Creates a custom category for the signed-in user.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = parseCategoryInput(await readBody(event))

  // Friendly duplicate check (case-insensitive, so "Groceries" and
  // "groceries" collide too) before we ever touch the database. The
  // @@unique([userId, name]) index is still the authoritative guard below.
  const existing = await prisma.category.findFirst({
    where: { userId: user.id, name: { equals: input.name, mode: 'insensitive' } }
  })
  if (existing) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Please fix the highlighted fields.',
      data: { fieldErrors: { name: 'You already have a category with this name.' } }
    })
  }

  try {
    const created = await prisma.category.create({
      data: {
        userId: user.id,
        name: input.name,
        color: input.color,
        icon: input.icon ?? null
      }
    })
    setResponseStatus(event, 201)
    return serializeCategory(created)
  } catch (err) {
    // Race-condition safety net: two identical requests landing at once can
    // both pass the check above, so the DB's own unique index has the final
    // word — turn its raw P2002 into the same friendly field error.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Please fix the highlighted fields.',
        data: { fieldErrors: { name: 'You already have a category with this name.' } }
      })
    }
    throw err
  }
})
