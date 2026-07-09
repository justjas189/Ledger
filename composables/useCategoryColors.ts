// Category → colour, the banking-app way.
// Each spending category gets one distinct, recognisable hue (Transport is
// always blue, Groceries always green, Dining always orange …) so transaction
// types can be told apart at a glance. The mapping is keyed on the category
// NAME rather than the database colour, because the seeded colours are muted
// near-neutrals; the database value stays as the fallback for names we don't
// recognise.
//
// Hues are Tailwind 500-step values — saturated enough to read on the dark
// surface, dark enough to hold on the light one.
const CATEGORY_HUES: Record<string, string> = {
  transport: '#3B82F6', // blue-500
  groceries: '#22C55E', // green-500
  dining: '#F97316', // orange-500
  utilities: '#EAB308', // yellow-500
  entertainment: '#A855F7', // purple-500
  shopping: '#EC4899' // pink-500
}

// Looser keyword fallbacks, so renamed or future categories still land on a
// sensible hue instead of the grey default.
const KEYWORD_HUES: Array<[RegExp, string]> = [
  [/transport|transit|commute|fuel|gas|car|bus|train/, '#3B82F6'],
  [/grocer|market|supermarket/, '#22C55E'],
  [/dining|food|restaurant|eat|coffee|snack/, '#F97316'],
  [/utilit|electric|water|internet|bill/, '#EAB308'],
  [/entertain|movie|game|music|stream/, '#A855F7'],
  [/shop|cloth|apparel/, '#EC4899'],
  [/health|medic|pharma|fitness/, '#F43F5E'], // rose-500
  [/home|house|rent|mortgage/, '#14B8A6'], // teal-500
  [/travel|flight|hotel|vacation/, '#0EA5E9'], // sky-500
  [/gift|donat/, '#D946EF'] // fuchsia-500
]

export function useCategoryColors() {
  /**
   * Resolve a category's display colour: exact name match first, then keyword
   * match, then the colour stored on the category itself.
   */
  const categoryColor = (name: string, fallback = '#64748B'): string => {
    const key = name.trim().toLowerCase()
    if (CATEGORY_HUES[key]) return CATEGORY_HUES[key]
    for (const [re, hue] of KEYWORD_HUES) {
      if (re.test(key)) return hue
    }
    return fallback
  }

  /** "#3B82F6" + 0.16 -> "rgba(59, 130, 246, 0.16)" — for soft tinted fills. */
  const withAlpha = (hex: string, alpha: number): string => {
    const h = hex.replace('#', '')
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
    const n = Number.parseInt(full, 16)
    if (Number.isNaN(n)) return `rgba(100, 116, 139, ${alpha})`
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
  }

  return { categoryColor, withAlpha }
}
