// Global display-currency state + conversion, shared app-wide.
// Vaulted stores every amount in a single base currency (USD) — the database
// and the locked API payload are never touched. This composable owns which
// currency those base amounts are DISPLAYED in, and the exchange rates used
// to mathematically convert them at render time.
//
// Rates are LIVE where possible (ROADMAP §1, "Live exchange rates"): on the
// client we fetch frankfurter.app (free, no key) once per day — same-origin
// via the Nitro `/proxy/rates` route rule (see nuxt.config.ts) so no CORS —
// cache the result in localStorage for 24h, and fall back to the static
// table below when offline or blocked. Conversion stays display-only.
//
// The choice persists to localStorage and lives in a single `useState`, so
// every formatted figure in the app re-converts instantly when it changes
// (all money rendering funnels through useFormatters().formatMoney /
// formatMoneyCompact, which read this).
export type CurrencyCode = 'USD' | 'PHP' | 'EUR' | 'GBP'

const STORAGE_KEY = 'vaulted-currency'
const RATES_KEY = 'vaulted-rates'
/** How long a fetched rate set stays fresh before we ask frankfurter again. */
const RATES_TTL_MS = 24 * 60 * 60 * 1000

/** Locale per currency, so grouping + symbol placement are right for each. */
export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  USD: 'en-US',
  PHP: 'en-PH',
  EUR: 'de-DE',
  GBP: 'en-GB'
}

/**
 * Static exchange rates, expressed as units per 1 USD (the base currency).
 * This is the OFFLINE FALLBACK: live rates replace these at runtime (see
 * loadRates), but conversion always works even with no network and no cache.
 */
export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  PHP: 58,
  EUR: 0.92,
  GBP: 0.79
}

/** Options for the currency dropdown, in display order. */
export const CURRENCY_OPTIONS: Array<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' }
]

const isCurrencyCode = (v: unknown): v is CurrencyCode =>
  typeof v === 'string' && CURRENCY_OPTIONS.some((o) => o.code === v)

export function useCurrency() {
  // USD is the default for first-time visitors (matches the stored base).
  const active = useState<CurrencyCode>('currency-active', () => 'USD')

  // Rates in effect (units per 1 USD). Start from the fallback; the client
  // swaps in cached/fresh live figures. Reactive, so every formatted amount
  // re-renders the moment better rates arrive.
  const rates = useState<Record<CurrencyCode, number>>('currency-rates', () => ({
    ...EXCHANGE_RATES
  }))
  // Once per session — every component calls useCurrency(), but only the
  // first loadRates() should do work.
  const ratesLoaded = useState<boolean>('currency-rates-loaded', () => false)

  /**
   * Validate an untrusted rate object (API response or localStorage) and
   * merge the usable entries over the fallback. Returns false when nothing
   * usable was found, leaving the current rates untouched.
   */
  function applyRates(raw: unknown): boolean {
    if (!raw || typeof raw !== 'object') return false
    const next = { ...EXCHANGE_RATES }
    let applied = 0
    for (const { code } of CURRENCY_OPTIONS) {
      if (code === 'USD') continue // base — always exactly 1
      const v = (raw as Record<string, unknown>)[code]
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        next[code] = v
        applied++
      }
    }
    if (applied === 0) return false
    rates.value = next
    return true
  }

  /**
   * Bring rates up to date: cached set first (even a stale one beats the
   * hardcoded table), then a frankfurter.app refresh (through the local
   * `/proxy/rates` proxy) when the cache is missing or older than 24h.
   * Every failure path degrades silently to whatever rates are in effect.
   */
  async function loadRates() {
    if (!import.meta.client || ratesLoaded.value) return
    ratesLoaded.value = true

    let fetchedAt = 0
    try {
      const raw = localStorage.getItem(RATES_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as { fetchedAt?: number; rates?: unknown }
        if (applyRates(cached.rates) && typeof cached.fetchedAt === 'number') {
          fetchedAt = cached.fetchedAt
        }
      }
    } catch {
      // Corrupt or blocked cache — treat as empty.
    }

    if (Date.now() - fetchedAt < RATES_TTL_MS) return

    try {
      const res = await $fetch<{ rates?: Record<string, number> }>('/proxy/rates', {
        query: {
          from: 'USD',
          to: CURRENCY_OPTIONS.filter((o) => o.code !== 'USD')
            .map((o) => o.code)
            .join(',')
        }
      })
      if (applyRates(res?.rates)) {
        try {
          localStorage.setItem(
            RATES_KEY,
            JSON.stringify({ fetchedAt: Date.now(), rates: res!.rates })
          )
        } catch {
          // Storage blocked: live rates still apply for this session.
        }
      }
    } catch {
      // Offline / API down: the fallback (or stale cache) keeps working.
    }
  }

  /** Restore the saved choice + kick off the daily rate refresh. Call once on mount (see layouts/default.vue). */
  function init() {
    if (!import.meta.client) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isCurrencyCode(saved)) active.value = saved
    } catch {
      // Private mode / blocked storage: fall back to the in-memory default.
    }
    void loadRates() // fire-and-forget; figures re-render when rates land
  }

  /** Switch the display currency (dropdown handler) and persist the choice. */
  function set(code: CurrencyCode) {
    if (!isCurrencyCode(code)) return
    active.value = code
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, code)
      } catch {
        // Storage blocked: the selection still works for this session.
      }
    }
  }

  /** Convert a base-USD amount into the active display currency. */
  const convert = (amountUsd: number) =>
    (Number.isFinite(amountUsd) ? amountUsd : 0) * rates.value[active.value]

  return { active, init, set, convert, rates }
}
