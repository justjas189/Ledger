// Category → colour, the banking-app way.
// Each spending category gets one distinct, recognisable hue (Transport is
// always blue, Groceries always green, Dining always orange …) so transaction
// types can be told apart at a glance.
//
// UPDATED LOGIC: 
// The user's explicit Database color now takes priority. If a custom color is 
// missing or invalid, we fall back to these hardcoded recognizable hues based on the name.

const CATEGORY_HUES: Record<string, string> = {
  transport: '#3B82F6', // blue-500
  groceries: '#22C55E', // green-500
  dining: '#F97316', // orange-500
  utilities: '#EAB308', // yellow-500
  entertainment: '#A855F7', // purple-500
  shopping: '#EC4899' // pink-500
}

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
   * Resolve a category's display colour: 
   * 1. Database custom color wins first.
   * 2. Exact name match fallback.
   * 3. Keyword regex match fallback.
   * 4. Ultimate grey fallback.
   */
  const categoryColor = (name: string, dbColor?: string | null): string => {
    // 1. PRIORITY: If a valid database color was passed in, use it immediately!
    if (dbColor && dbColor.startsWith('#')) {
      return dbColor
    }

    // 2 & 3. FALLBACK: If no DB color, check our banking-app keywords
    const key = name.trim().toLowerCase()
    if (CATEGORY_HUES[key]) return CATEGORY_HUES[key]
    
    for (const [re, hue] of KEYWORD_HUES) {
      if (re.test(key)) return hue
    }
    
    // 4. ULTIMATE FALLBACK
    return '#64748B' 
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