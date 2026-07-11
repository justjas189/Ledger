// GET /api/expenses
// Returns a paginated, searchable, filterable list of expenses.
//
// The file name encodes the route: `expenses/index.get.ts` => GET /api/expenses.
// Query params it understands:
//   page, pageSize            — pagination
//   search                    — matches the description (case-insensitive)
//   categoryId                — only this category
//   from, to                  — inclusive date range (yyyy-mm-dd)
import type { Prisma } from '@prisma/client'
import type { ExpenseListResponse } from '~/types/expense'

export default defineEventHandler(async (event): Promise<ExpenseListResponse> => {
  const user = await requireUser(event)
  const q = getQuery(event)

  // Clamp pagination to safe bounds so nobody can request 10,000 rows at once.
  const page = Math.max(1, Number(q.page) || 1)
  const pageSize = Math.min(50, Math.max(1, Number(q.pageSize) || 10))

  const search = typeof q.search === 'string' ? q.search.trim() : ''
  const categoryId =
    typeof q.categoryId === 'string' && q.categoryId ? q.categoryId : undefined

  // Build the WHERE clause piece by piece — only add a condition if it applies.
  // Tenant scope first — every filter below only narrows within this user.
  const where: Prisma.ExpenseWhereInput = { userId: user.id }
  if (search) where.description = { contains: search, mode: 'insensitive' }
  if (categoryId) where.categoryId = categoryId

  const from = typeof q.from === 'string' && q.from ? new Date(q.from) : null
  const to = typeof q.to === 'string' && q.to ? new Date(q.to) : null
  const dateFilter: Prisma.DateTimeFilter = {}
  if (from && !Number.isNaN(from.getTime())) dateFilter.gte = from
  if (to && !Number.isNaN(to.getTime())) {
    // Include the whole "to" day, right up to 23:59:59.999.
    const end = new Date(to)
    end.setHours(23, 59, 59, 999)
    dateFilter.lte = end
  }
  if (dateFilter.gte || dateFilter.lte) where.date = dateFilter

  // Run the count and the page query together for speed.
  const [total, rows] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  return {
    items: rows.map(serializeExpense),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  }
})
