// POST /api/goals
// Creates a savings bucket: a targeted goal (name + target + deadline) or an
// open-ended fund (name only — target/targetDate null, e.g. "Emergency
// Fund"). Either way it starts with no contributions, so both saved
// aggregates are 0 in the response.
import { Prisma } from '@prisma/client'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = parseSavingsGoalInput(await readBody(event))

  const created = await prisma.savingsGoal.create({
    data: {
      userId: user.id,
      name: input.name,
      target: input.target !== null ? new Prisma.Decimal(input.target.toFixed(2)) : null,
      targetDate: input.targetDate
    }
  })

  setResponseStatus(event, 201)
  return serializeSavingsGoal(created, { totalSaved: 0, thisMonthSaved: 0 })
})
