// Server-side input validation with Zod.
//
// NEVER trust data from the browser — a user (or a bug) can send anything.
// Zod checks the shape and rules of the incoming body and gives us a clean,
// fully-typed object to work with. If validation fails we throw a 400 error
// carrying per-field messages the form can display next to each input.
import { z } from 'zod'

// The rules for creating OR editing an expense (both use the same fields).
export const expenseInputSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, 'Description is required.')
    .max(200, 'Keep the description under 200 characters.'),

  // `coerce` turns the incoming value into a number first (JSON forms often
  // send strings), then we check it's a sensible, positive money amount.
  amount: z.coerce
    .number()
    .refine((n) => Number.isFinite(n), 'Amount must be a number.')
    .refine((n) => n > 0, 'Amount must be greater than 0.')
    .refine((n) => n <= 99999999.99, 'Amount is too large.'),

  // Accepts an ISO string or date and validates it's real.
  date: z.coerce
    .date()
    .refine((d) => !Number.isNaN(d.getTime()), 'Enter a valid date.'),

  categoryId: z.string().min(1, 'Choose a category.')
})

/** The clean, typed shape we get back after a successful parse. */
export type ExpenseInput = z.infer<typeof expenseInputSchema>

/**
 * Validate a request body. On success returns the typed input; on failure
 * throws a 400 whose `data.fieldErrors` maps field name -> message.
 */
export function parseExpenseInput(body: unknown): ExpenseInput {
  const result = expenseInputSchema.safeParse(body)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0]
      // Keep the first error per field — that's what we show under the input.
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'Please fix the highlighted fields.',
      data: { fieldErrors }
    })
  }
  return result.data
}
