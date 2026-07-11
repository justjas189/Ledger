// Shared types used by BOTH the server and the client, so the shape of the
// data flowing over the API is described in exactly one place.

/** A category as the browser receives it. */
export interface CategoryDTO {
  id: string
  name: string
  color: string
  icon: string | null
}

/**
 * An expense as the browser receives it.
 * Note `amount` is a plain `number` and dates are ISO strings — the server
 * converts Prisma's Decimal/Date objects before sending (see server/utils/
 * serialize.ts). DTO = "Data Transfer Object", the JSON-safe version.
 */
export interface ExpenseDTO {
  id: string
  description: string
  amount: number
  date: string
  categoryId: string
  category: CategoryDTO | null
  createdAt: string
  updatedAt: string
}

/**
 * A savings goal as the browser receives it. Money fields are plain numbers in
 * base USD (the server converts Prisma's Decimal); dates are ISO strings.
 * `totalSaved`/`thisMonthSaved` are aggregated from the contributions ledger
 * server-side (there is no flat "saved" column anymore).
 *
 * `target`/`targetDate` are null for an OPEN-ENDED FUND (e.g. "Emergency
 * Fund") — same bucket, same ledger, no finish line. A `targetDate` never
 * appears without a `target` (server invariant).
 */
export interface SavingsGoalDTO {
  id: string
  name: string
  /** Target amount, base USD — null for an open-ended fund. */
  target: number | null
  /** Deadline, ISO string — null when open-ended or no deadline set. */
  targetDate: string | null
  /** Sum of ALL contributions to this goal, base USD. */
  totalSaved: number
  /** Sum of contributions dated within the current calendar month, base USD. */
  thisMonthSaved: number
  createdAt: string
  updatedAt: string
}

/** The set of filters the expenses list can be narrowed by. */
export interface ExpenseFilters {
  search: string
  categoryId: string
  from: string
  to: string
}

/** The response shape for the paginated expenses list. */
export interface ExpenseListResponse {
  items: ExpenseDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/** One slice of the dashboard's by-category breakdown. */
export interface CategoryBreakdown {
  categoryId: string
  name: string
  color: string
  icon: string | null
  total: number
  count: number
}

/** One day's total spend, for the 30-day trend line. */
export interface DailyTrendPoint {
  /** Local calendar day as "YYYY-MM-DD". */
  date: string
  total: number
}

/** One forecast day: calendar day-of-month and its expected spend (base USD). */
export interface ForecastDay {
  day: number
  expected: number
}

/**
 * Response of GET /api/stats/forecast — the seasonal month-end projection
 * (weekday means + recurring day-of-month spikes over 90 days of history).
 */
export interface ForecastResponse {
  /** False when there isn't enough history to say anything useful. */
  ready: boolean
  /** Expected spend for each REMAINING day of the current month. */
  days: ForecastDay[]
  /** Month-to-date actual + the sum of expected remaining days. */
  projectedTotal: number
}

/** This month's spend vs the configured budget, per category. */
export interface BudgetComparison {
  categoryId: string
  name: string
  color: string
  spent: number
  budget: number
}

/** Everything the dashboard needs, in one request. */
export interface StatsResponse {
  currency: string
  thisMonthTotal: number
  lastMonthTotal: number
  /** Percent change vs last month, or null when last month was zero. */
  momChangePct: number | null
  thisMonthCount: number
  averageExpense: number
  allTimeTotal: number
  /** Configured monthly income (see server/utils/budgets.ts). */
  monthlyIncome: number
  /**
   * "Safe to spend": income minus this month's spend AND this month's savings
   * contributions — money committed to a goal is no longer available cash.
   */
  balance: number
  /**
   * Share of income deliberately put into savings goals this month
   * (thisMonthSaved / income), as a percentage. Explicit contributions, not the
   * old "whatever wasn't spent" residual.
   */
  savingsRate: number
  /** Savings-goal contributions dated in the current month, base USD. */
  thisMonthSaved: number
  /**
   * Spending pace: what the month-end total will be if spending continues at
   * the current daily rate — (spent / dayOfMonth) * daysInMonth.
   */
  projectedMonthTotal: number
  /** Sum of every category's monthly budget. */
  totalBudget: number
  /** True when the projection exceeds income or the total budget. */
  paceOverLimit: boolean
  topCategory: CategoryBreakdown | null
  breakdown: CategoryBreakdown[]
  /** Daily totals for the last 30 days, oldest first, zero-filled. */
  dailyTrend: DailyTrendPoint[]
  /** This month's spend vs budget for every category. */
  budgets: BudgetComparison[]
  /**
   * True once the user has set their own monthly budget (Profile.monthlyBudget).
   * False for a brand-new user → the dashboard shows the onboarding modal. Rides
   * in this payload so onboarding needs no separate (failure-prone) fetch.
   */
  onboarded: boolean
  recent: ExpenseDTO[]
}
