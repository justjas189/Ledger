// Budget configuration.
//
// The schema has no per-category Budget table, so category budgets are DERIVED
// from the user's own monthly budget (Profile.monthlyBudget) at request time.
// The numbers below are dimensionless WEIGHTS, not currency amounts: each
// category's budget is its share of the user's income, so per-category budgets
// always sum to the income the user actually set — never a hardcoded USD amount
// that ignores it. (Historically these were absolute USD figures, which made
// the rings show ₱30k "budgets" against a ₱10k income once converted.)
//
// When budgets become individually user-editable, replace this with a Prisma
// model and the stats API keeps the same response shape.

/** Relative spending weight per category. Higher = a bigger slice of income. */
export const CATEGORY_BUDGET_WEIGHTS: Record<string, number> = {
  Groceries: 500,
  Dining: 260,
  Transport: 160,
  Utilities: 320,
  Entertainment: 140,
  Shopping: 280
}

/** Weight for categories without an explicit entry above. */
export const DEFAULT_CATEGORY_WEIGHT = 200

/** Total monthly income fallback (base USD) until the user sets their own. */
export function monthlyIncome(): number {
  const fromEnv = Number(process.env.MONTHLY_INCOME)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 4500
}

/**
 * Split a monthly income across the user's categories by relative weight, so
 * the per-category budgets always sum to `income` (base USD). Returns the
 * budget keyed by category id. With no categories (or non-positive income) the
 * map is empty / all-zero, which the callers already handle.
 */
export function categoryBudgets(
  categories: Array<{ id: string; name: string }>,
  income: number
): Map<string, number> {
  const weightOf = (name: string) => CATEGORY_BUDGET_WEIGHTS[name] ?? DEFAULT_CATEGORY_WEIGHT
  const totalWeight = categories.reduce((sum, c) => sum + weightOf(c.name), 0)
  const budgets = new Map<string, number>()
  for (const c of categories) {
    budgets.set(c.id, totalWeight > 0 && income > 0 ? (income * weightOf(c.name)) / totalWeight : 0)
  }
  return budgets
}
