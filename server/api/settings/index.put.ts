// PUT /api/settings
// Sets the user's monthly budget (base USD). Upserts the profile row so it
// works whether or not the signup trigger already created one. Validated with
// Zod, same as expenses — RLS is row access, not input validation.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { monthlyBudget, currency } = parseSettingsInput(await readBody(event))

  const amount = new Prisma.Decimal(monthlyBudget.toFixed(2))
  // `currency` is optional (the budget-only editor omits it) — spread it in
  // only when present so a budget edit never clobbers the saved currency.
  const currencyPatch = currency ? { currency } : {}
  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: { monthlyBudget: amount, ...currencyPatch },
    create: { userId: user.id, monthlyBudget: amount, ...currencyPatch }
  })

  return { monthlyBudget: Number(profile.monthlyBudget), currency: profile.currency }
})
