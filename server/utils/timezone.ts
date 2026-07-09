// Timezone helpers for calendar math in the user's zone (ROADMAP §1 P2,
// unlock batch #1).
//
// The stats endpoints bucket expenses into months and days. Doing that with
// local `Date` methods uses the SERVER's zone, so a user ahead of (or behind)
// the server sees end-of-month entries land in the neighbouring bucket. These
// helpers redo the same calendar math in an arbitrary IANA zone using only
// Intl — ships with Node, no dependency.

/** Offset of `timeZone` from UTC at `date`, in milliseconds. */
function tzOffset(date: Date, timeZone: string): number {
  // "GMT+08:00" / "GMT-04:30" / plain "GMT" for UTC itself.
  const name =
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60_000
}

/**
 * The UTC instant of wall-clock midnight on `y-m-d` in `timeZone`.
 * Month/day may be out of range (m = 13, d = -5, …) — they normalise the same
 * way the `Date` constructor does, which is what the boundary math relies on.
 * Two offset passes so a DST jump right at midnight still lands correctly.
 */
export function zonedMidnightUtc(y: number, m: number, d: number, timeZone: string): Date {
  const guess = Date.UTC(y, m - 1, d)
  const once = guess - tzOffset(new Date(guess), timeZone)
  return new Date(guess - tzOffset(new Date(once), timeZone))
}

/** Calendar parts of `date` as seen from `timeZone` (m is 1-based). */
export function zonedParts(date: Date, timeZone: string): { y: number; m: number; d: number } {
  const [y, m, d] = zonedDateKey(date, timeZone).split('-').map(Number)
  return { y, m, d }
}

/** `date` as a "yyyy-mm-dd" wall-calendar key in `timeZone` (en-CA format). */
export function zonedDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date)
}
