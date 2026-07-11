// GET /api/goals
// The signed-in user's savings goals (oldest first) with their contribution
// aggregates — totalSaved and thisMonthSaved. Honours an optional ?tz=<IANA
// zone> so "this month" follows the user's calendar, like the stats endpoints.
import type { SavingsGoalDTO } from '~/types/expense'

export default defineEventHandler(async (event): Promise<SavingsGoalDTO[]> => {
  const user = await requireUser(event)
  const month = currentMonthRange(resolveTz(getQuery(event).tz))
  return goalsWithTotals(user.id, month)
})
