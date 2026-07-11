// Turns Prisma's rich database objects into plain, JSON-safe objects.
//
// Two things need converting before data goes over the wire:
//   • `amount` is a Prisma Decimal object, not a number. `Number(...)` turns
//     it into a normal JS number the frontend can format and add up.
//   • Dates become ISO strings so the client always gets a predictable shape.
//
// Doing this in one helper means every route returns identically-shaped data.
import type { Category, Expense, SavingsGoal } from '@prisma/client'
import type { CategoryDTO, ExpenseDTO, SavingsGoalDTO } from '~/types/expense'

// A category may or may not be joined onto the expense, depending on the query.
type ExpenseWithCategory = Expense & { category?: Category | null }

export function serializeCategory(c: Category): CategoryDTO {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    icon: c.icon ?? null
  }
}

export function serializeExpense(e: ExpenseWithCategory): ExpenseDTO {
  return {
    id: e.id,
    description: e.description,
    amount: Number(e.amount), // Decimal -> number
    date: e.date.toISOString(),
    categoryId: e.categoryId,
    category: e.category ? serializeCategory(e.category) : null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString()
  }
}

// The amount-saved aggregates are computed by the caller (see server/utils/
// goals.ts) from the contributions ledger, then handed in here — there's no
// flat column to read them from. `target`/`targetDate` are null for an
// open-ended fund (no finish line) — the client branches its card on that.
export function serializeSavingsGoal(
  g: SavingsGoal,
  totals: { totalSaved: number; thisMonthSaved: number }
): SavingsGoalDTO {
  return {
    id: g.id,
    name: g.name,
    target: g.target !== null ? Number(g.target) : null, // Decimal -> number
    targetDate: g.targetDate?.toISOString() ?? null,
    totalSaved: totals.totalSaved,
    thisMonthSaved: totals.thisMonthSaved,
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString()
  }
}
