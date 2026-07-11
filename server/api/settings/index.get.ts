// GET /api/settings
// The signed-in user's settings: the monthly budget (base USD, or null before
// onboarding — the dashboard uses null to decide whether to show the welcome
// modal) and their preferred display currency (defaults to USD).
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
  return {
    monthlyBudget: profile?.monthlyBudget != null ? Number(profile.monthlyBudget) : null,
    currency: profile?.currency ?? 'USD'
  }
})
