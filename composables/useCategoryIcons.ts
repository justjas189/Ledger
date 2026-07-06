// Maps a category's `icon` string (a kebab-case Lucide icon name stored in the
// database, e.g. "shopping-cart") to the actual Lucide-Vue component.
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
  Gift,
  HeartPulse,
  Home,
  Lightbulb,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Utensils,
  Wallet
} from 'lucide-vue-next'

const ICONS: Record<string, Component> = {
  bus: Bus,
  car: Car,
  clapperboard: Clapperboard,
  'circle-dollar-sign': CircleDollarSign,
  gift: Gift,
  'heart-pulse': HeartPulse,
  home: Home,
  lightbulb: Lightbulb,
  plane: Plane,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  utensils: Utensils,
  wallet: Wallet
}

export function useCategoryIcons() {
  /** Resolve an icon name to its component, or null when unknown/absent. */
  const resolveIcon = (name?: string | null): Component | null =>
    (name && ICONS[name]) || null

  return { resolveIcon }
}
