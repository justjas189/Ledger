// GET /api/categories
// Returns all categories (used to populate the form's dropdown and filters).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: { name: 'asc' }
  })
  return categories.map(serializeCategory)
})
