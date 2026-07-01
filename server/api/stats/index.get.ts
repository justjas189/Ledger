// GET /api/stats
// One request that returns everything the dashboard needs: this month's total,
// last month's total (for the comparison), a few headline numbers, the
// by-category breakdown for the chart, and the most recent entries.
//
// Doing the maths in the database with `aggregate` and `groupBy` is far faster
// than loading every row into Node and summing it by hand.
import type { CategoryBreakdown, StatsResponse } from '~/types/expense'

export default defineEventHandler(async (): Promise<StatsResponse> => {
  const currency = process.env.CURRENCY || 'USD'

  // Month boundaries, computed from "now". Using the 1st of each month as a
  // half-open range [start, next) avoids any end-of-day edge cases.
  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const [thisMonth, lastMonth, allTime, grouped, categories, recentRows] =
    await Promise.all([
      prisma.expense.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { date: { gte: startOfThisMonth, lt: startOfNextMonth } }
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { date: { gte: startOfLastMonth, lt: startOfThisMonth } }
      }),
      prisma.expense.aggregate({ _sum: { amount: true } }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        _sum: { amount: true },
        _count: { _all: true },
        where: { date: { gte: startOfThisMonth, lt: startOfNextMonth } }
      }),
      prisma.category.findMany(),
      prisma.expense.findMany({
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 6
      })
    ])

  const thisMonthTotal = Number(thisMonth._sum.amount ?? 0)
  const lastMonthTotal = Number(lastMonth._sum.amount ?? 0)
  const thisMonthCount = thisMonth._count

  // Month-over-month change. Undefined when last month was zero (dividing by
  // zero is meaningless) — the UI shows "new" in that case.
  const momChangePct =
    lastMonthTotal > 0
      ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100
      : null

  // Join each grouped total back to its category's name + colour, biggest first.
  const catById = new Map(categories.map((c) => [c.id, c]))
  const breakdown: CategoryBreakdown[] = grouped
    .map((g) => {
      const c = catById.get(g.categoryId)
      return {
        categoryId: g.categoryId,
        name: c?.name ?? 'Uncategorised',
        color: c?.color ?? '#5C6B60',
        icon: c?.icon ?? null,
        total: Number(g._sum.amount ?? 0),
        count: g._count._all
      }
    })
    .sort((a, b) => b.total - a.total)

  return {
    currency,
    thisMonthTotal,
    lastMonthTotal,
    momChangePct,
    thisMonthCount,
    averageExpense: thisMonthCount > 0 ? thisMonthTotal / thisMonthCount : 0,
    allTimeTotal: Number(allTime._sum.amount ?? 0),
    topCategory: breakdown[0] ?? null,
    breakdown,
    recent: recentRows.map(serializeExpense)
  }
})
