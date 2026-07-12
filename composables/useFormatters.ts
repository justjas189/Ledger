// Formatting helpers, shared by every component.
//
// Files in `composables/` are auto-imported by Nuxt, so any component can just
// call `useFormatters()` without importing it. Keeping formatting in one place
// means money and dates look identical everywhere in the app.
//
// Money is CONVERTED and rendered in the globally selected display currency
// (see useCurrency): amounts arrive in base USD, get multiplied by the active
// static exchange rate, then formatted with that currency's locale + symbol.
// Every call reads the shared state, so picking a currency from the dropdown
// re-converts every figure in the app at once.
export function useFormatters() {
  const { active: displayCurrency, convert } = useCurrency()

  /** Base-USD 1234.5 -> "$1,234.50", "₱71,601.00", "1.135,58 €", "Rp 22.221.000", … */
  const formatMoney = (amount: number) => {
    const digits = CURRENCY_FRACTION_DIGITS[displayCurrency.value]
    return new Intl.NumberFormat(CURRENCY_LOCALES[displayCurrency.value], {
      style: 'currency',
      currency: displayCurrency.value,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(convert(amount))
  }

  /** Base-USD 1234.5 -> "$1.2K" — for chart axes where full precision is noise. */
  const formatMoneyCompact = (amount: number) =>
    new Intl.NumberFormat(CURRENCY_LOCALES[displayCurrency.value], {
      style: 'currency',
      currency: displayCurrency.value,
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(convert(amount))

  /**
   * Like formatMoney, but skips the base-USD conversion — formats `amount` as
   * literal units of the active currency. Used to preview a currency's own
   * locale style (grouping/decimal separators, symbol placement) next to the
   * picker, e.g. formatMoneyLiteral(1000) -> "$1,000.00" or "Rp1.000".
   */
  const formatMoneyLiteral = (amount: number) => {
    const digits = CURRENCY_FRACTION_DIGITS[displayCurrency.value]
    return new Intl.NumberFormat(CURRENCY_LOCALES[displayCurrency.value], {
      style: 'currency',
      currency: displayCurrency.value,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(amount)
  }

  /** ISO string -> "3 Jul 2026" */
  const formatDate = (iso: string | Date) => {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    return new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d)
  }

  /** ISO string -> "2026-07-03" (the value a native <input type="date"> wants) */
  const formatDateInput = (iso: string | Date) => {
    const d = typeof iso === 'string' ? new Date(iso) : iso
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /** Date -> "July 2026" */
  const formatMonthLabel = (d: Date = new Date()) =>
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d)

  /** 12.3 -> "+12.3%" ; -4 -> "-4.0%" */
  const formatPercent = (pct: number) =>
    `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`

  return {
    formatMoney,
    formatMoneyCompact,
    formatMoneyLiteral,
    formatDate,
    formatDateInput,
    formatMonthLabel,
    formatPercent
  }
}
