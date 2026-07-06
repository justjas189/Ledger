// Budget configuration.
//
// The schema has no Budget table yet, so monthly budgets live here as plain
// config keyed by category name — enough to power the dashboard's
// spending-vs-budget chart and savings-rate metric without a migration.
// When budgets become user-editable, replace this with a Prisma model and
// the stats API keeps the same response shape.

/** Monthly budget per category, in the app currency. */
export const CATEGORY_BUDGETS: Record<string, number> = {
  Groceries: 500,
  Dining: 260,
  Transport: 160,
  Utilities: 320,
  Entertainment: 140,
  Shopping: 280
}

/** Fallback for categories without an explicit budget. */
export const DEFAULT_CATEGORY_BUDGET = 200

/** Total monthly income, used for balance + savings rate. Env-overridable. */
export function monthlyIncome(): number {
  const fromEnv = Number(process.env.MONTHLY_INCOME)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 4500
}
