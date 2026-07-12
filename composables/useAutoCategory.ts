// Auto-categorization (ROADMAP §3, Bonus).
//
// One keyword map, two consumers:
//   • the receipt OCR pipeline (useReceiptOcr) votes across the whole
//     recognized receipt text
//   • the expense form suggests a category live while the user types a
//     description — prefilling the dropdown until they pick one themselves
//
// Matching is a vote: every keyword found in the text counts one for its
// category, and the category with the most votes wins (ties keep the first
// map entry, so the order below is a mild priority). Single-word keywords
// match on WORD BOUNDARIES — "bar" must be the word "bar", not "barbell" —
// while multi-word keywords match as plain substrings.

/** Keyword votes per seed category (see prisma/seed.ts for the names). */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Groceries: [
    'grocery', 'groceries', 'supermarket', 'market', 'mart', 'produce',
    'walmart', 'costco', 'aldi', 'trader joe', 'deli', 'butcher', 'bakery',
    'puregold', 'food', 'meat', 'rice', 'milk', 'eggs', 'bread',
    'vegetables', 'fruit'
  ],
  Dining: [
    'restaurant', 'cafe', 'coffee', 'espresso', 'bar', 'grill', 'pizza',
    'burger', 'diner', 'bistro', 'sushi', 'ramen', 'taco', 'mcdonald',
    'starbucks', 'kfc', 'jollibee', 'server', 'table', 'dine',
    'lunch', 'dinner', 'breakfast', 'brunch', 'snack', 'milk tea',
    'takeout', 'foodpanda', 'doordash', 'mcdo'
  ],
  Transport: [
    'uber', 'lyft', 'grab', 'taxi', 'fare', 'fuel', 'gasoline', 'diesel',
    'gas station', 'shell', 'petron', 'caltex', 'chevron', 'parking',
    'toll', 'transit', 'metro', 'railway', 'airline',
    'bus', 'train', 'jeepney', 'tricycle', 'angkas', 'commute', 'flight',
    'mrt', 'lrt'
  ],
  Utilities: [
    'electric', 'electricity', 'water district', 'utility', 'utilities',
    'internet', 'broadband', 'telecom', 'meralco', 'pldt', 'billing period',
    'kwh', 'power',
    'water bill', 'electric bill', 'internet bill', 'phone bill', 'wifi',
    'converge', 'prepaid load'
  ],
  Entertainment: [
    'cinema', 'movie', 'theater', 'theatre', 'netflix', 'spotify', 'steam',
    'concert', 'ticket', 'arcade', 'bowling', 'museum',
    'game', 'gaming', 'disney', 'hbo', 'karaoke'
  ],
  Shopping: [
    'mall', 'boutique', 'apparel', 'clothing', 'shoes', 'outlet',
    'department store', 'electronics', 'amazon', 'lazada', 'shopee', 'ikea',
    'hardware', 'pharmacy',
    'shirt', 'dress', 'jacket', 'gadget', 'laptop', 'headphones',
    'uniqlo', 'zara', 'gift'
  ]
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Single words match on word boundaries; phrases match as substrings. */
function hasKeyword(haystack: string, keyword: string): boolean {
  if (keyword.includes(' ')) return haystack.includes(keyword)
  return new RegExp(`\\b${escapeRe(keyword)}\\b`).test(haystack)
}

/**
 * Suggest a category NAME for a piece of free text (a typed description or a
 * whole OCR'd receipt), or null when nothing matches. Callers map the name
 * onto a category id themselves.
 *
 * `customNames` is the user's OWN current category list (from useCategories,
 * a client fetch — there's no server involvement here at all, see
 * useReceiptOcr's file header). Pass it so a category with no curated
 * keyword entry — any self-created one, or a seed category the user renamed
 * — can still be suggested, by its own name appearing in the text. Without
 * it, only the six names in CATEGORY_KEYWORDS above can ever come back, no
 * matter what categories the user actually has.
 */
export function suggestCategory(text: string, customNames: string[] = []): string | null {
  const haystack = text.toLowerCase()
  if (!haystack.trim()) return null
  let bestName: string | null = null
  let bestVotes = 0
  for (const [name, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const votes = keywords.filter((k) => hasKeyword(haystack, k)).length
    if (votes > bestVotes) {
      bestVotes = votes
      bestName = name
    }
  }
  // A category with no curated keyword list gets ONE vote for its own name
  // appearing in the text — it only wins when nothing scored higher above, so
  // a real keyword match (e.g. "Starbucks" -> Dining) still takes it.
  for (const name of customNames) {
    if (CATEGORY_KEYWORDS[name]) continue // already scored via its own list
    if (bestVotes < 1 && hasKeyword(haystack, name.toLowerCase())) {
      bestVotes = 1
      bestName = name
    }
  }
  return bestName
}

/**
 * Ask the LLM-backed POST /api/categorize endpoint (NVIDIA NIM, primary +
 * secondary model fallback) to suggest a category NAME for a piece of free
 * text — the PRIMARY suggestion path now.
 * `customNames` is the user's current category list (e.g. from
 * useCategories() on the client); the endpoint can only ever return one of
 * these exact names, or null, never something invented.
 *
 * Falls back to the local keyword vote (suggestCategory, above) if the
 * endpoint is unreachable or errors — the same "smart endpoint, dumb offline
 * fallback" shape as useForecast() vs GET /api/stats/forecast — so a flaky
 * network or an exhausted API quota degrades the suggestion instead of
 * breaking it.
 */
export async function suggestCategoryAI(
  text: string,
  customNames: string[]
): Promise<string | null> {
  if (!text.trim() || customNames.length === 0) return null
  try {
    const { category } = await $fetch<{ category: string | null }>('/api/categorize', {
      method: 'POST',
      body: { text, categories: customNames }
    })
    return category
  } catch {
    return suggestCategory(text, customNames)
  }
}
