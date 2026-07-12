// DELETE /api/categories/:id
// Permanently removes a custom category — but only once nothing still points
// to it, so an expense is never left holding a dangling categoryId. There's
// no "General" fallback bucket to reassign into, so the user must move or
// remove those expenses first rather than have them silently orphaned.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')

  // Scope the existence check to the owner: another user's id 404s here
  // instead of being deletable.
  const existing = await prisma.category.findFirst({ where: { id, userId: user.id } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found.' })
  }

  const inUse = await prisma.expense.count({ where: { categoryId: id } })
  if (inUse > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Move or delete this category\u2019s expenses before removing it.'
    })
  }

  await prisma.category.delete({ where: { id } })
  return { id, deleted: true }
})
