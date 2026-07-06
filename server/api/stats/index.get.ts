// GET /api/stats
// One request that returns everything the dashboard needs: this month's total,
// last month's total (for the comparison), headline numbers (balance, savings
// rate), the by-category breakdown, a 30-day daily trend, spend-vs-budget per
// category, and the most recent entries.
//
// Doing the maths in the database with `aggregate` and `groupBy` is far faster
// than loading every row into Node and summing it by hand. The one exception
// is the daily trend: Prisma can't group by calendar day directly, so we pull
// 30 days of (date, amount) pairs — a small set — and bucket them here.
import type {
  BudgetComparison,
  CategoryBreakdown,
  DailyTrendPoint,
  StatsResponse
} from '~/types/expense'

export default defineEventHandler(async (): Promise<StatsResponse> => {
  const currency = process.env.CURRENCY || 'USD'

  // Month boundaries, computed from "now". Using the 1st of each month as a
  // half-open range [start, next) avoids any end-of-day edge cases.
  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // 30-day window for the trend line: today plus the 29 days before it.
  const trendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)

  const [thisMonth, lastMonth, allTime, grouped, categories, recentRows, trendRows] =
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
      }),
      prisma.expense.findMany({
        select: { date: true, amount: true },
        where: { date: { gte: trendStart } }
      })
    ])

  const thisMonthTotal = Number(thisMonth._sum.amount ?? 0)
  const lastMonthTotal = Number(lastMonth._sum.amount ?? 0)
  const thisMonthCount = thisMonth._count

  // Month-over-month change. Undefined when last month was zero (dividing by
  // zero is meaningless) — the UI shows "first tracked month" in that case.
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
        color: c?.color ?? '#64748B',
        icon: c?.icon ?? null,
        total: Number(g._sum.amount ?? 0),
        count: g._count._all
      }
    })
    .sort((a, b) => b.total - a.total)

  // --- 30-day daily trend, zero-filled so the line never has gaps ------------
  const dayKey = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const totalsByDay = new Map<string, number>()
  for (const row of trendRows) {
    const key = dayKey(row.date)
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + Number(row.amount))
  }
  const dailyTrend: DailyTrendPoint[] = []
  for (let i = 0; i < 30; i++) {
    const d = new Date(trendStart.getFullYear(), trendStart.getMonth(), trendStart.getDate() + i)
    const key = dayKey(d)
    dailyTrend.push({ date: key, total: totalsByDay.get(key) ?? 0 })
  }

  // --- Spend vs budget for every category (spent 0 when nothing logged) ------
  const spentByCategory = new Map(breakdown.map((b) => [b.categoryId, b.total]))
  const budgets: BudgetComparison[] = categories
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      spent: spentByCategory.get(c.id) ?? 0,
      budget: CATEGORY_BUDGETS[c.name] ?? DEFAULT_CATEGORY_BUDGET
    }))
    .sort((a, b) => b.spent - a.spent)

  // --- Income-derived headline metrics ---------------------------------------
  const income = monthlyIncome()
  const balance = income - thisMonthTotal
  const savingsRate = income > 0 ? (balance / income) * 100 : 0

  return {
    currency,
    thisMonthTotal,
    lastMonthTotal,
    momChangePct,
    thisMonthCount,
    averageExpense: thisMonthCount > 0 ? thisMonthTotal / thisMonthCount : 0,
    allTimeTotal: Number(allTime._sum.amount ?? 0),
    monthlyIncome: income,
    balance,
    savingsRate,
    topCategory: breakdown[0] ?? null,
    breakdown,
    dailyTrend,
    budgets,
    recent: recentRows.map(serializeExpense)
  }
})
