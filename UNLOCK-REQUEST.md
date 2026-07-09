# Backend Unlock Request — Batch #1

**Status:** ✅ Approved and applied 2026-07-09 ("unlock backend, apply the batch"). All three items are live: migration `20260708170237_pg_trgm_description_index` applied, `tz` support on `/api/stats`, and `/api/stats/forecast` serving the seasonal projection. Verified: typecheck clean, endpoints exercised over HTTP, EXPLAIN shows Bitmap Index Scan on the trigram index. The backend lock is back in force for anything beyond this batch. Original request below, kept for the record.

**Files that need the unlock:**

| Item | Locked files touched |
|---|---|
| 1. Timezone-correct month buckets | `server/api/stats/index.get.ts` |
| 2. `pg_trgm` search index | `prisma/schema.prisma` + one new migration |
| 3. Server-side forecast | new `server/api/stats/forecast.get.ts` |

None of the three changes the shape of any existing JSON response — existing clients keep working unchanged. Items 1 and 3 add opt-in query parameters / a new endpoint; item 2 is invisible at the API layer.

**Suggested apply order:** 2 → 1 → 3 (item 3 reuses item 1's timezone helpers).

---

## 1. Timezone-correct month buckets

### Problem

`server/api/stats/index.get.ts` computes every boundary (`startOfThisMonth`, `startOfNextMonth`, `startOfLastMonth`, `trendStart`) and the trend `dayKey()` with local `Date` methods, i.e. in the **server's** timezone. A user in UTC+8 who logs an expense at 23:30 on July 31 (local) stores an instant that is still July 31 in their world but July 31 15:30 **UTC** — with a UTC server that's fine, but the reverse case (user behind UTC, or server not on UTC) drops end-of-month entries into the neighbouring month. Same bug skews the 30-day trend buckets and the "spending pace" day-of-month math.

### Proposed change (recommended: `tz` query param, boundaries derived server-side)

Accept an optional IANA zone name and do all calendar math in that zone. Omitted/invalid `tz` → current behaviour, so the change is fully backward compatible.

Add two pure helpers (suggested home: `server/utils/timezone.ts`, imported by both stats routes):

```ts
// Offset of `timeZone` from UTC at `date`, in ms. Standard Intl round-trip trick.
function tzOffset(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]))
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return asUtc - date.getTime()
}

// The UTC instant of wall-clock midnight `y-m-d 00:00` in `timeZone`.
export function zonedMidnightUtc(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d)
  return new Date(guess - tzOffset(new Date(guess), timeZone))
}

// Calendar parts of `date` as seen from `timeZone` (en-CA gives yyyy-mm-dd).
export function zonedParts(date: Date, timeZone: string) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date).split('-').map(Number)
  return { y, m, d }
}
```

Then in `server/api/stats/index.get.ts`:

```ts
export default defineEventHandler(async (event): Promise<StatsResponse> => {
  const q = getQuery(event)
  const tz = resolveTz(q.tz)               // validated; null → legacy server-TZ path

  const now = new Date()
  const { y, m, d } = tz ? zonedParts(now, tz) : localParts(now)

  const startOfThisMonth = tz ? zonedMidnightUtc(y, m, 1, tz)     : new Date(y, m - 1, 1)
  const startOfNextMonth = tz ? zonedMidnightUtc(y, m + 1, 1, tz) : new Date(y, m, 1)
  const startOfLastMonth = tz ? zonedMidnightUtc(y, m - 1, 1, tz) : new Date(y, m - 2, 1)
  const trendStart       = tz ? zonedMidnightUtc(y, m, d - 29, tz): new Date(y, m - 1, d - 29)
  // (Date.UTC / the Date constructor both normalise out-of-range month/day.)
  ...
```

…and every calendar read further down switches to the zone-aware form when `tz` is set:

- trend `dayKey(row.date)` → `zonedParts(row.date, tz)` formatted `yyyy-mm-dd`;
- the zero-fill loop iterates 30 wall-clock days from `trendStart` via `zonedMidnightUtc`;
- pace math: `dayOfMonth = d`, `daysInMonth = zonedParts(zonedMidnightUtc(y, m + 1, 1, tz) - 1ms, tz).d`.

**Validation (Zod, `server/utils/validation.ts`):**

```ts
export const tzQuerySchema = z
  .string()
  .refine((v) => {
    try { new Intl.DateTimeFormat('en-US', { timeZone: v }); return true }
    catch { return false }
  }, 'invalid IANA timezone')
  .optional()
```

Invalid `tz` **falls back silently** to the legacy path rather than 400 — the stats endpoint must never brick the dashboard over a bad hint.

**Alternative considered (Option B):** client sends four pre-computed ISO boundary instants. Rejected: four spoofable params to cross-validate vs one self-contained zone name; Intl ships with Node, no dependency either way.

### Frontend follow-up (unlocked, done after approval)

`pages/index.vue` dashboard fetch adds `tz: Intl.DateTimeFormat().resolvedOptions().timeZone` to the query. Note the existing `routeRules` swr-60 cache keys on the full URL, so each zone gets its own cached variant — correct and cheap (users cluster in few zones).

### Acceptance checks

- Seed an expense at `2026-07-31T23:30+08:00`. `GET /api/stats?tz=Asia/Manila` counts it in July's `thisMonthTotal`; `GET /api/stats?tz=America/Los_Angeles` does not.
- `GET /api/stats` (no `tz`) returns byte-identical output to today's build on the same seed.
- Trend array still has exactly 30 zero-filled points across a DST transition (e.g. `tz=Europe/Berlin`, late March window).

---

## 2. `pg_trgm` GIN index on `expenses.description`

### Problem

`server/api/expenses/index.get.ts` search uses `contains` + `mode: 'insensitive'` → SQL `ILIKE '%term%'`. A leading-wildcard ILIKE cannot use the default b-tree indexes, so Postgres sequential-scans `expenses` on every keystroke; past ~10k rows the search box turns to molasses.

### Proposed change

Trigram GIN index. No query change — Prisma's generated `ILIKE` automatically picks the index up. Zero API-contract impact.

**`prisma/schema.prisma`** (schema-native route, keeps `migrate dev` truthful):

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_trgm]
}

model Expense {
  // ...existing fields unchanged...
  @@index([description(ops: raw("gin_trgm_ops"))], type: Gin)
}
```

Generated migration (`npx prisma migrate dev --name pg_trgm_description_index`) will contain:

```sql
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE INDEX "expenses_description_idx" ON "expenses" USING GIN ("description" gin_trgm_ops);
```

**Operational notes:**

- `CREATE EXTENSION` needs a role allowed to install extensions; `pg_trgm` is on the allowlist of every major managed Postgres (Supabase, Neon, RDS, Railway).
- Prisma migrations run in a transaction, so this is a plain (locking) `CREATE INDEX`. Fine at portfolio scale; if the table were already huge, hand-edit the migration to `CREATE INDEX CONCURRENTLY` and mark it `-- migration is not transactional`.

### Acceptance checks

- Seed ≥10k expenses. `EXPLAIN ANALYZE SELECT * FROM expenses WHERE description ILIKE '%coffee%'` shows **Bitmap Index Scan** on the new index, not Seq Scan.
- Search behaviour in the UI is byte-identical (same results, same ordering) — only faster.

---

## 3. Server-side forecast

### Problem

Feature 1 shipped client-side: `composables/useForecast.ts` runs on the shared 90-day raw-row pool (`useExpenseHistory`), meaning every dashboard visit ships ~90 days of individual rows to the browser just to reduce them to ~90 daily totals. Correct, but wasteful at scale, and the numbers are recomputed per client.

### Proposed change

New route `server/api/stats/forecast.get.ts` that ports the **exact** algorithm of `useForecast.ts` (single source of truth for the maths lives in this repo already — port constants verbatim):

- window: `HISTORY_DAYS = 90` ending **yesterday** (exclude the half-logged today);
- weekday means over the zero-filled daily series;
- recurring day-of-month spikes = median residual above weekday mean, gated by `MIN_SPIKE_SAMPLES = 2` and `spikeFloor = max(20, 1.5 × overallMean)`;
- not ready below `MIN_OBSERVED_DAYS = 14` observed days;
- `projectedTotal` = month-to-date actual + Σ expected for remaining days.

Server does one narrow query — `prisma.expense.findMany({ select: { date: true, amount: true }, where: { date: { gte: windowStart } } })` — buckets to daily totals, then runs the same pure function. **Depends on item 1:** daily bucketing and "today"/"day of month" must use the same `tz` param and helpers, or the forecast re-introduces the exact bug item 1 fixes.

**Contract (new endpoint, additive only):**

```
GET /api/stats/forecast?tz=Asia/Manila
→ { ready: boolean, days: Array<{ day: number, expected: number }>, projectedTotal: number }
```

Shape matches the client's existing `ForecastDay` interface, so the swap is drop-in. Add `'/api/stats/forecast': { swr: 60 }` to the existing `routeRules` block.

### Frontend follow-up (unlocked, done after approval)

`useForecast()` fetches the endpoint and keeps the current client computation as the offline/error fallback; its public signature (`ready`, `forecastDays`, `projectedTotal`) is unchanged, so no component edits.

### Acceptance checks

- Parity: on an identical seeded fixture, endpoint output equals the client `useForecast` output (same `days`, `projectedTotal` within float tolerance).
- `ready: false` (empty `days`) below 14 observed days.
- Dashboard payload shrinks: raw 90-day rows no longer needed by the forecast path.

---

## Out of scope, stays locked

No other backend change rides along. Rebrand ("Vaulted") remains frontend-only; no Zod schema is loosened; no existing response field is renamed, removed, or retyped.
