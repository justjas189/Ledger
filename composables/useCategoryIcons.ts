// Maps a category's `icon` string (a kebab-case Lucide icon name stored in the
// database, e.g. "shopping-cart") to the actual Lucide-Vue component, AND
// provides `getCategoryIcon(name)` — a keyword-based auto-detection utility
// that infers an appropriate icon from a category's display name so custom
// categories show a meaningful icon instead of the generic colour dot.
//
// Keeping the lookup here — instead of rendering whatever string the database
// holds — means the UI can only ever show icons from this approved, on-brand
// set. Unknown values (including legacy emoji from old seeds) resolve to
// `null` and the component falls back to the category's colour dot.
import type { Component } from 'vue'
import {
  Bus,
  Car,
  Clapperboard,
  CircleDollarSign,
  Coffee,
  CreditCard,
  Gift,
  HeartPulse,
  Home,
  Lightbulb,
  Monitor,
  Pill,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Stethoscope,
  Tv,
  Utensils,
  Wallet
} from 'lucide-vue-next'

const ICONS: Record<string, Component> = {
  bus: Bus,
  car: Car,
  clapperboard: Clapperboard,
  'circle-dollar-sign': CircleDollarSign,
  coffee: Coffee,
  'credit-card': CreditCard,
  gift: Gift,
  'heart-pulse': HeartPulse,
  home: Home,
  lightbulb: Lightbulb,
  monitor: Monitor,
  pill: Pill,
  plane: Plane,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  stethoscope: Stethoscope,
  tv: Tv,
  utensils: Utensils,
  wallet: Wallet
}

// Keyword → icon-name mapping for automatic detection. Order matters: the
// first matching group wins, so more specific keywords (e.g. "jollibee") sit
// above broader ones (e.g. "food"). Each regex is tested against the
// lowercased category name.
const KEYWORD_ICONS: Array<[RegExp, string]> = [
  // Health / Medical
  [/health|medic|checkup|doctor|pharma|clinic|hospital|dental|vitamin/, 'heart-pulse'],
  // Subscriptions / Streaming / Digital services
  [/subscri|netflix|spotify|premium|hulu|disney|youtube|apple\s?tv|hbo|stream/, 'tv'],
  // Groceries / Supermarket
  [/grocer|supermarket|market|produce|pantry/, 'shopping-cart'],
  // Dining / Restaurant / Coffee
  [/dining|restaurant|jollibee|mcdo|mcdonald|cafe|coffee|starbucks|eat|dine|fast\s?food|takeout|take-out/, 'utensils'],
  // Food (general, after dining/groceries so it serves as a catch-all)
  [/food|snack|meal|lunch|dinner|breakfast|brunch/, 'utensils'],
  // Transport
  [/transport|transit|commute|fuel|gas|grab|uber|taxi|ride|bus|train|mrt|lrt/, 'car'],
  // Shopping / Clothing
  [/shop|cloth|apparel|fashion|mall|retail|lazada|shopee/, 'shopping-bag'],
  // Travel / Flights / Hotels
  [/travel|flight|hotel|vacation|airbnb|booking|trip|tour/, 'plane'],
  // Home / Housing / Rent
  [/home|house|rent|mortgage|condo|apartment|property/, 'home'],
  // Utilities / Bills
  [/utilit|electric|water|internet|wifi|bill|phone|mobile|data|telco/, 'lightbulb'],
  // Entertainment / Leisure
  [/entertain|movie|game|gaming|music|concert|cinema|theater|theatre|hobby/, 'clapperboard'],
  // Gifts / Donations
  [/gift|donat|charit|present|tithe/, 'gift'],
  // Finance / Fees / Insurance
  [/insur|invest|savings|bank|fee|tax|loan|credit|debt/, 'wallet'],
  // Education
  [/edu|school|tuition|course|book|learn|study/, 'monitor'],
  // Personal care / Fitness
  [/fitness|gym|salon|barber|spa|beauty|haircut|self-care|selfcare/, 'stethoscope']
]

/**
 * Infer a Lucide icon name from a category's display name by keyword matching.
 * Returns the kebab-case icon key (e.g. "utensils") or `null` when no keywords
 * match — callers fall back to the colour dot in that case.
 */
export function getCategoryIcon(name: string): string | null {
  const key = name.trim().toLowerCase()
  for (const [re, icon] of KEYWORD_ICONS) {
    if (re.test(key)) return icon
  }
  return null
}

export function useCategoryIcons() {
  /** Resolve an icon name to its component, or null when unknown/absent. */
  const resolveIcon = (name?: string | null): Component | null =>
    (name && ICONS[name]) || null

  return { resolveIcon, getCategoryIcon }
}
