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
  const user = await requireUser(event)
  // Per-user monthly budget drives the income figure below. `.catch(() => null)`
  // keeps the dashboard alive even before the profiles table exists (falls back
  // to the configured default), so this change is safe to deploy ahead of the
  // migration.
  const profile = await prisma.profile
    .findUnique({ where: { userId: user.id } })
    .catch(() => null)
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

  const [thisMonth, lastMonth, allTime, grouped, categories, recentRows, trendRows, thisMonthContrib] =
    await Promise.all([
      prisma.expense.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { userId: user.id, date: { gte: startOfThisMonth, lt: startOfNextMonth } }
      }),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { userId: user.id, date: { gte: startOfLastMonth, lt: startOfThisMonth } }
      }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { userId: user.id } }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        _sum: { amount: true },
        _count: { _all: true },
        where: { userId: user.id, date: { gte: startOfThisMonth, lt: startOfNextMonth } }
      }),
      prisma.category.findMany({ where: { userId: user.id } }),
      prisma.expense.findMany({
        where: { userId: user.id },
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 6
      }),
      prisma.expense.findMany({
        select: { date: true, amount: true },
        where: { userId: user.id, date: { gte: trendStart } }
      }),
      // Savings put aside THIS month, from the SavingsContribution ledger. Same
      // tz-aware month window as the figures above, so it matches the goals
      // card's "this month" badge. `.catch(() => null)` keeps the dashboard
      // alive if the table doesn't exist yet (pre-migration), like `profile`.
      prisma.savingsContribution
        .aggregate({
          _sum: { amount: true },
          where: { userId: user.id, date: { gte: startOfThisMonth, lt: startOfNextMonth } }
        })
        .catch(() => null)
    ])

  const thisMonthTotal = Number(thisMonth._sum.amount ?? 0)
  const lastMonthTotal = Number(lastMonth._sum.amount ?? 0)
  const thisMonthCount = thisMonth._count
  // Money deliberately moved into savings goals this month (base USD).
  const thisMonthSaved = Number(thisMonthContrib?._sum.amount ?? 0)

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

  // --- Income-derived headline metrics ---------------------------------------
  // The user's own monthly budget (Profile.monthlyBudget, set at onboarding) is
  // authoritative; fall back to the configured default until they've set one.
  const income =
    profile?.monthlyBudget != null ? Number(profile.monthlyBudget) : monthlyIncome()
  // "Safe to spend": income minus what's been spent AND what's been set aside in
  // savings goals this month. Money allocated to a goal is committed, not
  // available cash — leaving it in the balance invites overspending against it.
  const balance = income - thisMonthTotal - thisMonthSaved
  // Savings rate = the share of income DELIBERATELY put into goals this month,
  // not the naive "whatever wasn't spent" residual (which counted idle cash as
  // saved). Contributions are always positive, so this never goes negative.
  const savingsRate = income > 0 ? (thisMonthSaved / income) * 100 : 0

  // --- Spend vs budget for every category (spent 0 when nothing logged) ------
  // Category budgets are a share of the user's own income (see budgets.ts), so
  // the rings can never show a budget the total income can't cover.
  const spentByCategory = new Map(breakdown.map((b) => [b.categoryId, b.total]))
  const budgetByCategory = categoryBudgets(categories, income)
  const budgets: BudgetComparison[] = categories
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      color: c.color,
      spent: spentByCategory.get(c.id) ?? 0,
      budget: budgetByCategory.get(c.id) ?? 0
    }))
    .sort((a, b) => b.spent - a.spent)

  // --- Spending pace ----------------------------------------------------------
  // Straight-line projection: if the month keeps spending at today's average
  // daily rate, where does it land? Noisy in the first few days (one grocery
  // run on the 1st projects to 30 grocery runs), but it converges fast and is
  // exactly the early warning a mid-month glance needs.
  const dayOfMonth = p.d
  const daysInMonth = new Date(Date.UTC(p.y, p.m, 0)).getUTCDate()
  const projectedMonthTotal = (thisMonthTotal / dayOfMonth) * daysInMonth
  // Budgets sum to income when the user has categories, so this is really an
  // "over income" check; the `> 0` guard keeps a category-less user (empty
  // budgets) from tripping the warning on any spend at all.
  const totalBudget = budgets.reduce((sum, b) => sum + b.budget, 0)
  // Money already put into savings this month is committed, not spendable — the
  // same reason it's out of the Safe to Spend balance above. So the spending
  // pace has to clear a LOWER ceiling: income minus what's been saved. This is
  // what makes the projection warn when a user is pacing to overdraft their
  // remaining (post-savings) cash, not just their gross income. Floored at 0 so
  // a month that saved more than income can't invert the check.
  const paceCeiling = Math.max(0, income - thisMonthSaved)
  const paceOverLimit =
    projectedMonthTotal > paceCeiling || (totalBudget > 0 && projectedMonthTotal > totalBudget)

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
    thisMonthSaved,
    projectedMonthTotal,
    totalBudget,
    paceOverLimit,
    topCategory: breakdown[0] ?? null,
    breakdown,
    dailyTrend,
    budgets,
    // Onboarding flag: has the user set their own budget yet? Drives the
    // dashboard's welcome modal without a second request.
    onboarded: profile?.monthlyBudget != null,
    recent: recentRows.map(serializeExpense)
  }
})
