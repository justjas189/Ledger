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
  topCategory: CategoryBreakdown | null
  breakdown: CategoryBreakdown[]
  recent: ExpenseDTO[]
}
