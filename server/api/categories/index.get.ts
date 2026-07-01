// GET /api/categories
// Returns all categories (used to populate the form's dropdown and filters).
export default defineEventHandler(async () => {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  })
  return categories.map(serializeCategory)
})
