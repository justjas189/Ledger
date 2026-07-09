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
//
// Calendar math honours an optional `?tz=<IANA zone>` query param (unlock
// batch #1): month boundaries, trend buckets, and pace math all follow the
// user's zone so end-of-month entries land in the month the user experienced.
// Missing or invalid `tz` falls back to the server's zone — the pre-tz
// behaviour, byte-identical output.
import type {
  BudgetComparison,
  CategoryBreakdown,
  DailyTrendPoint,
  StatsResponse
} from '~/types/expense'

export default defineEventHandler(async (event): Promise<StatsResponse> => {
  const currency = process.env.CURRENCY || 'USD'
  const tz = resolveTz(getQuery(event).tz)

  // Where "now" sits on the calendar — in the requested zone when given,
  // otherwise in the server's zone. `m` is 1-based throughout.
  const now = new Date()
  const p = tz
    ? zonedParts(now, tz)
    : { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() }

  // Month boundaries as UTC instants. Using the 1st of each month as a
  // half-open range [start, next) avoids any end-of-day edge cases. Both
  // branches normalise out-of-range month/day the same way (m + 1 in
  // December rolls into January, d - 29 walks into the previous month).
  const startOfThisMonth = tz ? zonedMidnightUtc(p.y, p.m, 1, tz) : new Date(p.y, p.m - 1, 1)
  const startOfNextMonth = tz ? zonedMidnightUtc(p.y, p.m + 1, 1, tz) : new Date(p.y, p.m, 1)
  const startOfLastMonth = tz ? zonedMidnightUtc(p.y, p.m - 1, 1, tz) : new Date(p.y, p.m - 2, 1)
  // 30-day window for the trend line: today plus the 29 days before it.
  const trendStart = tz
    ? zonedMidnightUtc(p.y, p.m, p.d - 29, tz)
    : new Date(p.y, p.m - 1, p.d - 29)

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
  // Each stored instant maps to the calendar day the user experienced.
  const dayKey = (date: Date) => {
    if (tz) return zonedDateKey(date, tz)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const totalsByDay = new Map<string, number>()
  for (const row of trendRows) {
    const key = dayKey(row.date)
    totalsByDay.set(key, (totalsByDay.get(key) ?? 0) + Number(row.amount))
  }
  // Walk 30 wall-calendar days from the trend start. A UTC-anchored Date is
  // just a calendar carrier here (no zone conversion), so the same walk
  // serves both the tz and the legacy path.
  const dailyTrend: DailyTrendPoint[] = []
  const cursor = new Date(Date.UTC(p.y, p.m - 1, p.d - 29))
  for (let i = 0; i < 30; i++) {
    const key = cursor.toISOString().slice(0, 10)
    dailyTrend.push({ date: key, total: totalsByDay.get(key) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
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

  // --- Spending pace ----------------------------------------------------------
  // Straight-line projection: if the month keeps spending at today's average
  // daily rate, where does it land? Noisy in the first few days (one grocery
  // run on the 1st projects to 30 grocery runs), but it converges fast and is
  // exactly the early warning a mid-month glance needs.
  const dayOfMonth = p.d
  const daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()
  const projectedMonthTotal = (thisMonthTotal / dayOfMonth) * daysInMonth
  const totalBudget = budgets.reduce((sum, b) => sum + b.budget, 0)
  const paceOverLimit = projectedMonthTotal > income || projectedMonthTotal > totalBudget

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
    projectedMonthTotal,
    totalBudget,
    paceOverLimit,
    topCategory: breakdown[0] ?? null,
    breakdown,
    dailyTrend,
    budgets,
    recent: recentRows.map(serializeExpense)
  }
})
