// Database seed script.
//
// Running `npm run db:seed` (or `prisma migrate reset`) executes this file to
// fill an empty database with realistic sample data, so the app looks alive
// the moment you open it.
//
// Dates are generated RELATIVE TO TODAY (this month + the two previous months)
// so the dashboard's "this month vs last month" comparison always has numbers
// to show, no matter which day you run the seed.
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// Each category carries the colour the UI uses for its chart slice + pill.
const CATEGORIES = [
  { name: 'Groceries', color: '#1E5A48', icon: '🛒' },
  { name: 'Dining', color: '#B7892F', icon: '🍽️' },
  { name: 'Transport', color: '#3E6C8E', icon: '🚌' },
  { name: 'Utilities', color: '#6E8B3D', icon: '💡' },
  { name: 'Entertainment', color: '#7A5B8E', icon: '🎬' },
  { name: 'Shopping', color: '#B23A2E', icon: '🛍️' }
] as const

// Believable descriptions + amount ranges (in dollars) per category.
const DETAILS: Record<string, { notes: string[]; min: number; max: number }> = {
  Groceries: { notes: ['Weekly grocery run', 'Supermarket', 'Fresh produce & bread', 'Corner store top-up'], min: 12, max: 140 },
  Dining: { notes: ['Lunch with the team', 'Coffee & pastry', 'Dinner out', 'Takeaway'], min: 6, max: 85 },
  Transport: { notes: ['Bus pass top-up', 'Taxi ride home', 'Fuel', 'Train ticket'], min: 3, max: 70 },
  Utilities: { notes: ['Electricity bill', 'Water bill', 'Internet plan', 'Mobile plan'], min: 25, max: 160 },
  Entertainment: { notes: ['Cinema tickets', 'Streaming subscription', 'Concert ticket', 'New game'], min: 8, max: 120 },
  Shopping: { notes: ['New shirt', 'Household items', 'Headphones', 'Birthday gift'], min: 10, max: 220 }
}

// --- tiny random helpers ---------------------------------------------------
const rand = (min: number, max: number) => Math.random() * (max - min) + min
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]
const money = (min: number, max: number) => new Prisma.Decimal(rand(min, max).toFixed(2))

/** Describe a calendar month `offset` months from `base` and how many entries to place in it. */
function monthBucket(base: Date, offset: number, count: number) {
  const d = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const year = d.getFullYear()
  const month = d.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // For the current month, only place entries up to today; past months use the whole month.
  const maxDay = offset === 0 ? base.getDate() : daysInMonth
  return { year, month, maxDay, count }
}

async function main() {
  console.log('🌱  Seeding database…')

  // Start clean so re-running the seed is always predictable.
  // Delete expenses first — they reference categories (foreign key).
  await prisma.expense.deleteMany()
  await prisma.category.deleteMany()

  // Create categories and remember each id by name.
  const idByName: Record<string, string> = {}
  for (const c of CATEGORIES) {
    const created = await prisma.category.create({ data: c })
    idByName[c.name] = created.id
  }
  console.log(`   • ${CATEGORIES.length} categories`)

  // Spread sample expenses across the current month and the two before it.
  const now = new Date()
  const buckets = [
    monthBucket(now, 0, 11), // this month (so the dashboard hero has data)
    monthBucket(now, -1, 16), // last month (so month-over-month can compare)
    monthBucket(now, -2, 14) // the month before that (for the list + trends)
  ]

  const data: Prisma.ExpenseCreateManyInput[] = []
  for (const b of buckets) {
    for (let i = 0; i < b.count; i++) {
      const cat = pick(CATEGORIES)
      const detail = DETAILS[cat.name]
      const day = 1 + Math.floor(Math.random() * b.maxDay)
      const hour = 8 + Math.floor(Math.random() * 12)
      data.push({
        description: pick(detail.notes),
        amount: money(detail.min, detail.max),
        date: new Date(b.year, b.month, day, hour, 0, 0),
        categoryId: idByName[cat.name]
      })
    }
  }

  await prisma.expense.createMany({ data })
  console.log(`   • ${data.length} expenses`)
  console.log('✅  Seed complete.')
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
