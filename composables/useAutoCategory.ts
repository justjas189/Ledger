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
 * Suggest a seed-category NAME for a piece of free text (a typed description
 * or a whole OCR'd receipt), or null when nothing matches. Callers map the
 * name onto a category id themselves.
 */
export function suggestCategory(text: string): string | null {
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
  return bestName
}
