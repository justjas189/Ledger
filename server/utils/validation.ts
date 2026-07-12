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

// Optional `tz` query param (IANA zone name) for the calendar-math endpoints.
// Zod handles shape; Intl is the authority on whether the zone exists.
const tzSchema = z.string().trim().min(1).max(64)

/**
 * Resolve a `tz` query value to a valid IANA zone, or null. Invalid and
 * missing values both resolve to null — the stats endpoints then fall back to
 * server-zone math rather than failing the whole dashboard over a bad hint.
 */
export function resolveTz(value: unknown): string | null {
  const parsed = tzSchema.safeParse(value)
  if (!parsed.success) return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: parsed.data })
    return parsed.data
  } catch {
    return null
  }
}

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

// A positive money amount within Decimal(10,2) range — the shared rule for a
// budget, a savings target, or an amount saved. Reused so every stored amount
// obeys the same bounds as an expense.
const moneyAmount = z.coerce
  .number()
  .refine((n) => Number.isFinite(n), 'Enter a valid amount.')
  .refine((n) => n <= 99999999.99, 'That amount is too large.')

/** The display currencies we support, mirrored on the client (useCurrency). */
export const CURRENCY_CODES = ['USD', 'PHP', 'EUR', 'GBP', 'IDR'] as const

// --- Settings --------------------------------------------------------------
// The per-user monthly budget (base USD) and preferred display currency. Same
// money rules as an expense amount — positive and within Decimal(10,2) range.
// `currency` is optional so the budget-only editor can leave it untouched.
export const settingsInputSchema = z.object({
  monthlyBudget: moneyAmount.refine((n) => n > 0, 'Budget must be greater than 0.'),
  currency: z.enum(CURRENCY_CODES).optional()
})

export type SettingsInput = z.infer<typeof settingsInputSchema>

export function parseSettingsInput(body: unknown): SettingsInput {
  return parseWithFieldErrors(settingsInputSchema, body)
}

// --- Savings goals ---------------------------------------------------------
// `target` is base USD, entered in the active display currency and converted
// client-side (like the budget field). `targetDate` is the deadline. BOTH are
// now optional/nullable: a goal without them is an open-ended fund (e.g.
// "Emergency Fund") that shares the same contributions ledger. Invariant —
// a targetDate requires a target: a deadline with no amount means nothing.
const goalName = z
  .string()
  .trim()
  .min(1, 'Give the goal a name.')
  .max(60, 'Keep the name under 60 characters.')

const goalTarget = moneyAmount.refine((n) => n > 0, 'Enter a target greater than 0.')

const goalTargetDate = z.coerce
  .date()
  .refine((d) => !Number.isNaN(d.getTime()), 'Choose a target date.')

export const savingsGoalInputSchema = z
  .object({
    name: goalName,
    // Absent and explicit null both mean "open-ended"; normalise to null so
    // the routes only ever deal with one empty value.
    target: goalTarget.nullish().transform((v) => v ?? null),
    targetDate: goalTargetDate.nullish().transform((v) => v ?? null)
  })
  .refine((v) => v.targetDate === null || v.target !== null, {
    message: 'A deadline needs a target amount.',
    path: ['target']
  })

export type SavingsGoalInput = z.infer<typeof savingsGoalInputSchema>

export function parseSavingsGoalInput(body: unknown): SavingsGoalInput {
  return parseWithFieldErrors(savingsGoalInputSchema, body)
}

// A PATCH-style edit of the goal itself (name / target / deadline) — any subset,
// but at least one. Adding money is NOT here: that's a contribution (below).
// `target`/`targetDate` accept explicit null to CLEAR them (targeted goal →
// open-ended fund). The targetDate-requires-target invariant spans the body
// AND the existing row, so the route checks it after merging.
export const savingsGoalUpdateSchema = z
  .object({
    name: goalName.optional(),
    target: goalTarget.nullable().optional(),
    targetDate: goalTargetDate.nullable().optional()
  })
  .refine((v) => v.name !== undefined || v.target !== undefined || v.targetDate !== undefined, {
    message: 'Nothing to update.',
    path: ['name']
  })

export type SavingsGoalUpdate = z.infer<typeof savingsGoalUpdateSchema>

export function parseSavingsGoalUpdate(body: unknown): SavingsGoalUpdate {
  return parseWithFieldErrors(savingsGoalUpdateSchema, body)
}

// One deposit toward a goal (the "Add funds" flow). Base USD, > 0. The date is
// set server-side to now, so it's not accepted from the client.
export const contributionInputSchema = z.object({
  amount: moneyAmount.refine((n) => n > 0, 'Enter an amount greater than 0.')
})

export type ContributionInput = z.infer<typeof contributionInputSchema>

export function parseContributionInput(body: unknown): ContributionInput {
  return parseWithFieldErrors(contributionInputSchema, body)
}

// --- Categories ------------------------------------------------------------
// `name` is capped well below what the bubble chart's canvas text-scaling can
// comfortably fit — a long name should shrink gracefully, not force every
// bubble to shrink with it. `color` must be a 6-digit hex, matching every
// seeded default (e.g. "#0F766E"). `icon` is optional/nullable: there's no
// icon picker in the UI yet, and useCategoryIcons() already falls back to the
// colour dot for any name it doesn't recognise, so we only bound its length.
const categoryName = z
  .string()
  .trim()
  .min(1, 'Give the category a name.')
  .max(24, 'Keep the name under 24 characters.')

const categoryColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Choose a valid color.')

const categoryIcon = z.string().trim().min(1).max(40).nullish().transform((v) => v ?? null)

export const categoryInputSchema = z.object({
  name: categoryName,
  color: categoryColor,
  icon: categoryIcon.optional()
})

export type CategoryInput = z.infer<typeof categoryInputSchema>

export function parseCategoryInput(body: unknown): CategoryInput {
  return parseWithFieldErrors(categoryInputSchema, body)
}

// --- AI categorization ------------------------------------------------------
// Powers POST /api/categorize (NVIDIA NIM). `text` is a typed description or
// a whole OCR'd receipt, bounded generously so it comfortably fits either, but
// not unbounded — this caps token usage/cost per request. `categories` is the
// user's OWN current category names (from useCategories on the client), each
// already bounded to the same 24 chars enforced when a category is created
// (see categoryName above); the array itself is capped so a pathological
// payload can't inflate the prompt.
const categorizeText = z.string().trim().min(1).max(3000)

const categorizeCategories = z.array(z.string().trim().min(1).max(24)).max(50)

export const categorizeInputSchema = z.object({
  text: categorizeText,
  categories: categorizeCategories
})

export type CategorizeInput = z.infer<typeof categorizeInputSchema>

export function parseCategorizeInput(body: unknown): CategorizeInput {
  return parseWithFieldErrors(categorizeInputSchema, body)
}

/**
 * Shared safeParse → typed value, or a 400 whose `data.fieldErrors` maps field
 * name -> first message. Every parse helper funnels through this so error
 * shapes stay identical across routes.
 */
function parseWithFieldErrors<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body)
  if (!result.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path[0]
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
