<script setup lang="ts">
// The add / edit expense form, shown inside the slide-out drawer.
// One component handles BOTH creating and editing: if an `editing` expense is
// passed in we pre-fill the fields and PUT on save; otherwise we start blank
// and POST. The parent owns whether the drawer is open.
//
// The request payloads are identical to Ledger's — the server API contract
// is locked; only the shell around it changed.
//
// Receipt OCR quick-add: on the create form, "Scan a receipt" runs
// tesseract.js in the browser (see useReceiptOcr) and prefills description /
// amount / date / category from the photo. Nothing is submitted automatically
// — the user reviews and confirms, and any field the scan couldn't read is
// simply left for them.
//
// Auto-categorization: while the user types a description, the shared
// keyword map (useAutoCategory) proposes a category and moves the dropdown —
// but only until they pick one themselves.
import { ScanLine, Sparkles } from 'lucide-vue-next'
import type { ExpenseDTO } from '~/types/expense'

const props = defineProps<{
  open: boolean
  editing: ExpenseDTO | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

// Counter so two rapid optimistic creates from this drawer never share an id.
let optimisticSeq = 0

const { data: categories } = useCategories()
const { active: activeCurrency, rates } = useCurrency()
const { formatDateInput, formatMonthLabel } = useFormatters()

// Visual prefix on the amount field, following the display currency.
const currencySymbol = computed(
  () => CURRENCY_OPTIONS.find((o) => o.code === activeCurrency.value)?.symbol ?? '$'
)

// --- Bidirectional currency conversion ------------------------------------
// The user types and edits amounts in the ACTIVE display currency; the locked
// API and database only ever see base USD (Decimal(10,2), i.e. cents).
//   submit:  display -> USD   (toBaseUsd, rounded to cents)
//   edit:    USD -> display   (toDisplayAmount, prefilling the input)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Amount typed in the active currency -> base USD for the API payload. */
const toBaseUsd = (display: number) => round2(display / rates.value[activeCurrency.value])

/** Base-USD amount from the API -> the active currency for the input field. */
const toDisplayAmount = (usd: number) => round2(usd * rates.value[activeCurrency.value])
const toast = useToast()
const { addPending, removePending } = useOptimisticExpenses()
const { open: reopenQuickAdd } = useQuickAdd()
const { scanning, progress, scan } = useReceiptOcr()

// When a background create fails we reopen the drawer with the user's values
// (and any server field errors) intact — this flag tells the open-watcher to
// skip the usual reset for that one open.
let restoreOnOpen = false

// The form fields (kept as strings, the way inputs give them to us).
const form = reactive({
  description: '',
  amount: '',
  date: '',
  categoryId: ''
})
// Field-level error messages, keyed by field name. Filled by client checks
// AND by the server's validation response.
const errors = reactive<Record<string, string>>({})
const saving = ref(false)

const isEdit = computed(() => props.editing !== null)

function clearErrors() {
  for (const k of Object.keys(errors)) delete errors[k]
}

// (Re)fill the form whenever the drawer opens.
function resetForm() {
  clearErrors()
  categoryTouched.value = false
  suggestedName.value = null
  if (props.editing) {
    form.description = props.editing.description
    // The stored amount is base USD — show it in the active currency so the
    // user edits the number they actually see everywhere else in the app.
    form.amount = String(toDisplayAmount(props.editing.amount))
    form.date = formatDateInput(props.editing.date)
    form.categoryId = props.editing.categoryId
  } else {
    form.description = ''
    form.amount = ''
    form.date = formatDateInput(new Date()) // default to today
    form.categoryId = categories.value?.[0]?.id ?? ''
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    if (restoreOnOpen) {
      restoreOnOpen = false
      return
    }
    resetForm()
  }
)
// If categories arrive after the form opened, pick a sensible default.
watch(categories, (list) => {
  if (props.open && !props.editing && !form.categoryId) {
    form.categoryId = list?.[0]?.id ?? ''
  }
})
// If the display currency switches while the drawer is open (the command
// palette can do that), re-express the typed amount in the new currency so
// it keeps meaning the same money and submit converts from the right rate.
watch(activeCurrency, (next, prev) => {
  if (!props.open || !form.amount) return
  const n = Number(form.amount)
  if (!Number.isFinite(n)) return
  form.amount = String(round2((n / rates.value[prev]) * rates.value[next]))
})

// --- Auto-categorization (ROADMAP §3, Bonus) ------------------------------
// Watch the CREATE form's description and prefill the category dropdown from
// the local keyword map (useAutoCategory) — synchronous and instant, so it
// can run on every keystroke with no debounce. The AI gateway
// (suggestCategoryAI / POST /api/categorize) added real latency here for a
// live-typing suggestion and has been pulled back out; it's reserved for the
// asynchronous "Natural Language Expense Entry" feature instead (see
// ai_features_roadmap.md), where a round-trip is expected and acceptable.
// The suggestion never overrides a human: picking a category by hand — or a
// receipt scan, which read the whole receipt and knows more than the
// description line — switches it off for that entry.
const categoryTouched = ref(false)
const suggestedName = ref<string | null>(null)

function onCategoryPicked() {
  categoryTouched.value = true
  suggestedName.value = null
}

watch(
  () => form.description,
  (text) => {
    if (!props.open || isEdit.value || categoryTouched.value) return
    const name = suggestCategory(text, categories.value?.map((c) => c.name) ?? [])
    const match = name
      ? categories.value?.find((c) => c.name.toLowerCase() === name.toLowerCase())
      : undefined
    if (match) {
      form.categoryId = match.id
      suggestedName.value = match.name
    } else if (suggestedName.value) {
      // The text stopped pointing anywhere — drop back to the default pick.
      suggestedName.value = null
      form.categoryId = categories.value?.[0]?.id ?? ''
    }
  }
)

// A quick client-side check so obvious mistakes are caught instantly. The
// server validates too — it's the real authority — but this saves a round-trip.
function validate() {
  clearErrors()
  const amount = Number(form.amount)
  if (!form.description.trim()) errors.description = 'Description is required.'
  if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter an amount greater than 0.'
  }
  if (!form.date) errors.date = 'Choose a date.'
  if (!form.categoryId) errors.categoryId = 'Choose a category.'
  return Object.keys(errors).length === 0
}

// --- Receipt OCR --------------------------------------------------------
// Hidden file input + button; on mobile `capture` opens the camera straight
// away. The scan fills whichever fields it could read and leaves the rest.
const receiptInput = ref<HTMLInputElement | null>(null)

function pickReceipt() {
  receiptInput.value?.click()
}

async function onReceiptChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-picking the same file after a retry
  if (!file) return

  try {
    const parsed = await scan(file, categories.value?.map((c) => c.name) ?? [])
    let filled = 0
    if (parsed.description) {
      form.description = parsed.description
      filled++
    }
    if (parsed.amount !== null) {
      form.amount = String(parsed.amount)
      filled++
    }
    if (parsed.date) {
      form.date = parsed.date
      filled++
    }
    if (parsed.categoryName) {
      const match = categories.value?.find(
        (c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase()
      )
      if (match) {
        form.categoryId = match.id
        filled++
        // The scan's whole-receipt vote beats the description heuristic —
        // stop the live suggestion from second-guessing it.
        categoryTouched.value = true
        suggestedName.value = null
      }
    }
    if (filled === 0) {
      toast.info("Couldn't read details from that photo — try a clearer shot or enter them manually.")
    } else {
      clearErrors()
      toast.success('Receipt scanned — double-check the details, then save.')
    }
  } catch {
    toast.error("Couldn't read that receipt. Try a clearer, well-lit photo.")
  }
}

type SaveErrorBody = {
  statusMessage?: string
  message?: string
  data?: { fieldErrors?: Record<string, string> }
}

async function submit() {
  if (!validate()) return
  const amountUsd = toBaseUsd(Number(form.amount))
  if (amountUsd <= 0) {
    // A sub-cent USD amount (e.g. ₱0.20) rounds to $0.00 and the server
    // would reject it — catch it here with a message that explains why.
    errors.amount = 'Amount is less than $0.01 USD after conversion.'
    return
  }
  const payload = {
    description: form.description.trim(),
    amount: amountUsd,
    // Parse as LOCAL midnight so the saved day matches what the user picked.
    date: new Date(`${form.date}T00:00:00`).toISOString(),
    categoryId: form.categoryId
  }

  // --- Edit: keep the drawer open until the PUT confirms -----------------
  if (isEdit.value) {
    saving.value = true
    try {
      await $fetch(`/api/expenses/${props.editing!.id}`, { method: 'PUT', body: payload })
      // An edited amount/date shifts every derived number — bust the same
      // caches a create does (stats, list, forecast) before handing back.
      await refreshSpendingCaches()
      toast.success('Changes saved.')
      emit('saved')
      emit('close')
    } catch (err: unknown) {
      // The server sends field-level messages under data.fieldErrors on a 400.
      const body = (err as { data?: SaveErrorBody })?.data
      const fieldErrors = body?.data?.fieldErrors
      if (fieldErrors) {
        Object.assign(errors, fieldErrors)
      } else {
        toast.error(body?.statusMessage || 'Could not save this expense. Please try again.')
      }
    } finally {
      saving.value = false
    }
    return
  }

  // --- Create: optimistic — close now, POST in the background ------------
  // The entry appears in every list immediately via useOptimisticExpenses;
  // the server row replaces it once the refresh lands. On failure the drawer
  // reopens with the user's input (and any field errors) intact.
  const nowIso = new Date().toISOString()
  const temp: ExpenseDTO = {
    id: `optimistic-${Date.now()}-${++optimisticSeq}`,
    description: payload.description,
    amount: payload.amount,
    date: payload.date,
    categoryId: payload.categoryId,
    category: categories.value?.find((c) => c.id === payload.categoryId) ?? null,
    createdAt: nowIso,
    updatedAt: nowIso
  }
  // Snapshot the input: the shared drawer may be reused (or reset) while the
  // POST is in flight, so a failure restores exactly what was submitted.
  const snapshot = { ...form }

  addPending(temp)
  emit('close')

  try {
    await $fetch('/api/expenses', { method: 'POST', body: payload })
    // Converge on server truth BEFORE dropping the temp row, so the entry
    // never flickers out and back in. Targeted busting (stats payload,
    // expenses list, forecast) — see refreshSpendingCaches.
    await refreshSpendingCaches()
    toast.success('Expense added.')
    emit('saved')
  } catch (err: unknown) {
    const body = (err as { data?: SaveErrorBody })?.data
    Object.assign(form, snapshot)
    clearErrors()
    if (body?.data?.fieldErrors) {
      Object.assign(errors, body.data.fieldErrors)
    } else {
      toast.error(body?.statusMessage || 'Could not save this expense — nothing was added.')
    }
    restoreOnOpen = true
    reopenQuickAdd()
  } finally {
    removePending(temp.id)
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="isEdit ? 'Edit expense' : 'Add expense'"
    :subtitle="formatMonthLabel()"
    @close="emit('close')"
  >
    <form class="space-y-5" novalidate @submit.prevent="submit">
      <!-- Scan a receipt (create only — editing already has the details) -->
      <div v-if="!isEdit">
        <input
          ref="receiptInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="sr-only"
          aria-hidden="true"
          tabindex="-1"
          @change="onReceiptChange"
        />
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-edge/20 bg-edge/5 px-4 py-3 text-sm font-medium text-ink-soft transition-colors duration-200 hover:border-emerald-500/50 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="scanning"
          @click="pickReceipt"
        >
          <ScanLine class="h-4 w-4" aria-hidden="true" />
          <span v-if="scanning" class="font-mono tnum" aria-live="polite">
            Reading receipt… {{ Math.round(progress * 100) }}%
          </span>
          <span v-else>Scan a receipt</span>
        </button>
        <p class="mt-1.5 text-xs text-ink-faint">
          Snap a photo — the details below fill themselves in for you to confirm.
        </p>
      </div>

      <!-- Description -->
      <div>
        <label for="description" class="label">Description</label>
        <input
          id="description"
          v-model="form.description"
          type="text"
          class="field"
          :class="{ 'field-invalid': errors.description }"
          placeholder="e.g. Weekly grocery run"
          maxlength="200"
        />
        <p v-if="errors.description" class="mt-1 text-xs text-negative">{{ errors.description }}</p>
      </div>

      <!-- Amount + Date, side by side -->
      <div class="grid gap-5 sm:grid-cols-2">
        <div>
          <label for="amount" class="label">Amount</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
            >
              {{ currencySymbol }}
            </span>
            <input
              id="amount"
              v-model="form.amount"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-8 font-mono tnum"
              :class="{ 'field-invalid': errors.amount }"
              placeholder="0.00"
            />
          </div>
          <p v-if="errors.amount" class="mt-1 text-xs text-negative">{{ errors.amount }}</p>
        </div>

        <div>
          <label for="date" class="label">Date</label>
          <input
            id="date"
            v-model="form.date"
            type="date"
            class="field font-mono tnum"
            :class="{ 'field-invalid': errors.date }"
          />
          <p v-if="errors.date" class="mt-1 text-xs text-negative">{{ errors.date }}</p>
        </div>
      </div>

      <!-- Category -->
      <div>
        <label for="category" class="label">Category</label>
        <select
          id="category"
          v-model="form.categoryId"
          class="field"
          :class="{ 'field-invalid': errors.categoryId }"
          @change="onCategoryPicked"
        >
          <option value="" disabled>Choose a category…</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.name }}
          </option>
        </select>
        <p v-if="errors.categoryId" class="mt-1 text-xs text-negative">{{ errors.categoryId }}</p>
        <p
          v-else-if="suggestedName"
          class="mt-1 flex items-center gap-1 text-xs text-ink-faint"
        >
          <Sparkles class="h-3 w-3 text-positive" aria-hidden="true" />
          Suggested from the description — change it if we guessed wrong.
        </p>
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="emit('close')">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="submit">
        {{ saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense' }}
      </button>
    </template>
  </Drawer>
</template>
