// Formatting helpers, shared by every component.
//
// Files in `composables/` are auto-imported by Nuxt, so any component can just
// call `useFormatters()` without importing it. Keeping formatting in one place
// means money and dates look identical everywhere in the app.
export function useFormatters() {
  /** 1234.5 -> "$1,234.50" */
  const formatMoney = (amount: number, currency = 'USD') =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0)

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
    formatDate,
    formatDateInput,
    formatMonthLabel,
    formatPercent
  }
}
