// User-editable monthly income / budget limit.
//
// The server's monthlyIncome (server/utils/budgets.ts) is plain config and
// the stats API is locked, so the user's own figure lives client-side:
// localStorage behind a shared useState, the same pattern as savings goals.
// The value is BASE USD like every stored amount — it renders through
// formatMoney and converts with the display currency.
//
// Because the locked payload bakes income into balance / savingsRate /
// paceOverLimit, adjust() re-derives exactly those fields from the override
// on the client. No override → the payload passes through untouched.
import type { StatsResponse } from '~/types/expense'

const STORAGE_KEY = 'vaulted-monthly-income'

const round2 = (n: number) => Math.round(n * 100) / 100

const isValidIncome = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0

export function useMonthlyBudget() {
  /** The user's income override in base USD, or null to use the server figure. */
  const override = useState<number | null>('monthly-income-override', () => null)
  const loaded = useState<boolean>('monthly-income-loaded', () => false)

  /** Restore from localStorage. Idempotent; call from any consumer. */
  function load() {
    if (!import.meta.client || loaded.value) return
    loaded.value = true
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (isValidIncome(parsed)) override.value = parsed
    } catch {
      // Corrupt or blocked storage: fall back to the server figure.
    }
  }

  /** Save a new monthly income (base USD). Returns false on bad input. */
  function set(usd: number): boolean {
    if (!isValidIncome(usd)) return false
    override.value = round2(usd)
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(override.value))
      } catch {
        // Storage blocked: the override lasts for the session only.
      }
    }
    return true
  }

  /** Drop the override and return to the server-configured income. */
  function clear() {
    override.value = null
    if (import.meta.client) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // Storage blocked: nothing stored to remove anyway.
      }
    }
  }

  /**
   * Re-derive the income-dependent fields of the locked stats payload with
   * the user's override applied. Pure and cheap; reading `override` inside a
   * computed keeps every consumer reactive to edits.
   */
  function adjust(s: StatsResponse): StatsResponse {
    const income = override.value
    if (income === null || income === s.monthlyIncome) return s
    return {
      ...s,
      monthlyIncome: income,
      balance: round2(income - s.thisMonthTotal),
      savingsRate: income > 0 ? ((income - s.thisMonthTotal) / income) * 100 : 0,
      paceOverLimit:
        s.projectedMonthTotal > income || s.projectedMonthTotal > s.totalBudget
    }
  }

  return { override, loaded, load, set, clear, adjust }
}
