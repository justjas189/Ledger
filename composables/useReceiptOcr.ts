// Receipt OCR quick-add (ROADMAP §3, Feature 2).
//
// The user snaps/uploads a receipt photo; we read the text and prefill the
// expense form with { description, amount, date, suggested category } for
// them to confirm. The API is locked, so recognition runs ENTIRELY in the
// browser via tesseract.js (dynamic import — the ~2 MB engine never touches
// the main bundle and only loads on first scan).
//
// OCR text is messy, so extraction is heuristic by design:
//   • amount   — prefer the money figure on a "total / amount due" line,
//                fall back to the largest figure on the receipt.
//   • date     — first parseable date in the common numeric / month-name
//                formats; obviously-future dates are treated as misreads.
//   • merchant — the first "name-looking" line near the top (receipts open
//                with the store name; addresses and phone lines are skipped).
//   • category — keyword vote across the whole text, mapped onto the app's
//                seed category names (shared with the form's live
//                auto-categorization — see useAutoCategory).
// Anything we can't extract stays null and the field is left for the user.

export interface ReceiptScan {
  description: string | null
  /** Parsed amount, already a positive number. */
  amount: number | null
  /** Local "yyyy-mm-dd", ready for the <input type="date">. */
  date: string | null
  /** A seed-category NAME guess (the form maps it onto an id). */
  categoryName: string | null
  /** The raw recognized text, kept for debugging. */
  rawText: string
}

// Lines that are ABOUT the transaction rather than the merchant — never a
// good description.
const NOT_A_MERCHANT =
  /receipt|invoice|order|cashier|terminal|tel[.:]?|phone|fax|vat|tin|reg[.:]|www\.|http|welcome|thank|customer|copy|date[:\s]|time[:\s]|#/i

// A money-looking token: optional currency mark, digits, and a 2-digit
// decimal tail with either separator ("1,234.56", "1.234,56", "12,34").
const MONEY_TOKEN = /(?:[$€£₱]\s*)?\d{1,3}(?:[.,\s]\d{3})*[.,]\d{2}\b/g

const TOTAL_LINE = /\b(grand\s*total|amount\s*due|balance\s*due|total)\b/i
const NOT_TOTAL_LINE = /sub\s*-?\s*total|tax|vat|change|tender|cash|savings|discount/i

const MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
]

/** "1,234.56" / "1.234,56" / "12,34" -> 1234.56 / 1234.56 / 12.34 */
export function parseMoneyToken(raw: string): number | null {
  const s = raw.replace(/[^\d.,]/g, '')
  if (!s) return null
  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','))
  // The final separator is the decimal point; every earlier one is thousands.
  const normalized =
    lastSep === -1
      ? s
      : `${s.slice(0, lastSep).replace(/[.,]/g, '')}.${s.slice(lastSep + 1)}`
  const n = Number(normalized)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null
}

function extractAmount(lines: string[]): number | null {
  // Pass 1: explicit total lines, scanned bottom-up (the grand total sits
  // below any sub-totals), taking the LAST figure on the line.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!TOTAL_LINE.test(line) || NOT_TOTAL_LINE.test(line)) continue
    const tokens = line.match(MONEY_TOKEN)
    if (!tokens?.length) continue
    const value = parseMoneyToken(tokens[tokens.length - 1])
    if (value !== null) return value
  }
  // Pass 2: the largest money figure anywhere — on most receipts that IS the
  // total (item prices are all smaller).
  let best: number | null = null
  for (const line of lines) {
    for (const token of line.match(MONEY_TOKEN) ?? []) {
      const value = parseMoneyToken(token)
      if (value !== null && (best === null || value > best)) best = value
    }
  }
  return best
}

function toDateKey(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getMonth() !== m - 1 || date.getDate() !== d) return null
  // A receipt from the future is a misread — reject and keep looking.
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date > tomorrow) return null
  return `${date.getFullYear()}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function extractDate(text: string): string | null {
  // yyyy-mm-dd / yyyy.mm.dd / yyyy/mm/dd
  for (const m of text.matchAll(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g)) {
    const key = toDateKey(Number(m[1]), Number(m[2]), Number(m[3]))
    if (key) return key
  }
  // "Jul 3, 2026" / "July 3 2026"
  const monthAlt = MONTHS.join('|')
  for (const m of text.matchAll(
    new RegExp(`\\b(${monthAlt})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'gi')
  )) {
    const key = toDateKey(Number(m[3]), MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, Number(m[2]))
    if (key) return key
  }
  // "3 Jul 2026"
  for (const m of text.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthAlt})[a-z]*\\.?,?\\s+(\\d{4})`, 'gi')
  )) {
    const key = toDateKey(Number(m[3]), MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1, Number(m[1]))
    if (key) return key
  }
  // mm/dd/yyyy (or dd/mm — disambiguated by which part fits as a month).
  for (const m of text.matchAll(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/g)) {
    const [a, b, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const key =
      a > 12
        ? toDateKey(y, b, a) // first part can't be a month -> dd/mm
        : (toDateKey(y, a, b) ?? toDateKey(y, b, a)) // default mm/dd, swap if invalid
    if (key) return key
  }
  return null
}

function extractMerchant(lines: string[]): string | null {
  for (const line of lines.slice(0, 7)) {
    const clean = line.replace(/\s{2,}/g, ' ').replace(/[|*_=~-]{2,}/g, '').trim()
    if (clean.length < 3 || clean.length > 60) continue
    if (NOT_A_MERCHANT.test(clean)) continue
    const letters = (clean.match(/[a-z]/gi) ?? []).length
    const digits = (clean.match(/\d/g) ?? []).length
    // Merchant names are words, not numbers — skip address / register lines.
    if (letters < 3 || digits > letters) continue
    // ALL-CAPS headers read shouty in the form — soften to Title Case.
    const name = clean === clean.toUpperCase() ? toTitleCase(clean) : clean
    return name.slice(0, 200)
  }
  return null
}

function toTitleCase(s: string) {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/])([a-z])/g, (match) => match.toUpperCase())
}

export function parseReceiptText(rawText: string, customNames: string[] = []): ReceiptScan {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  return {
    description: extractMerchant(lines),
    amount: extractAmount(lines),
    date: extractDate(rawText),
    categoryName: suggestCategory(rawText, customNames),
    rawText
  }
}

export function useReceiptOcr() {
  const scanning = ref(false)
  /** 0 → 1 recognition progress, for the button label. */
  const progress = ref(0)

  /** Run OCR on an image file and return whatever fields could be parsed.
   *  `customNames` — the user's live category list — is passed straight
   *  through to suggestCategory (see useAutoCategory) so a self-created
   *  category can be recognised too, not just the six seed names. This is
   *  local and instant — the AI gateway (suggestCategoryAI) is no longer
   *  wired in here; it's reserved for the asynchronous "Natural Language
   *  Expense Entry" feature instead (see ai_features_roadmap.md). */
  async function scan(file: File, customNames: string[] = []): Promise<ReceiptScan> {
    scanning.value = true
    progress.value = 0
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') progress.value = m.progress
        }
      })
      try {
        const { data } = await worker.recognize(file)
        return parseReceiptText(data.text, customNames)
      } finally {
        await worker.terminate()
      }
    } finally {
      scanning.value = false
    }
  }

  return { scanning, progress, scan }
}
