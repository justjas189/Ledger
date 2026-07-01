// Turns Prisma's rich database objects into plain, JSON-safe objects.
//
// Two things need converting before data goes over the wire:
//   • `amount` is a Prisma Decimal object, not a number. `Number(...)` turns
//     it into a normal JS number the frontend can format and add up.
//   • Dates become ISO strings so the client always gets a predictable shape.
//
// Doing this in one helper means every route returns identically-shaped data.
import type { Category, Expense } from '@prisma/client'
import type { CategoryDTO, ExpenseDTO } from '~/types/expense'

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
