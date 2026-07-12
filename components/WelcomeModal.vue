<script setup lang="ts">
// First-run onboarding. Unskippable by design: no backdrop-close, no Esc, no
// cancel — the only way out is to set a monthly budget. Rendered by the
// dashboard only when the user's Profile.monthlyBudget is still null.
// Mirrors EditBudgetModal's field (works in the active display currency,
// stores base USD) so the two budget dialogs read as one family.
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'
import type { CurrencyCode } from '~/composables/useCurrency'

const emit = defineEmits<{ saved: [] }>()

const { active, rates, set: setCurrency } = useCurrency()
const { formatMoney } = useFormatters()
const toast = useToast()

// A11y (ROADMAP §5): unskippable ≠ untrapped. The same shared focus trap as
// Modal/Drawer/palette keeps Tab inside and marks the page behind inert —
// but with NO onEscape, so Escape stays a no-op and the dialog remains the
// only way forward. Teleported to <body> (below) because the trap inerts the
// app root; rendered in place, the modal would inert itself.
const panel = ref<HTMLElement | null>(null)
const trap = useFocusTrap(panel)

onMounted(() => {
  document.body.style.overflow = 'hidden'
  trap.activate()
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  trap.deactivate()
})

const amountInput = ref('')
const error = ref('')
const saving = ref(false)

const symbol = computed(
  () => CURRENCY_OPTIONS.find((o) => o.code === active.value)?.symbol ?? '$'
)

// The currency picker drives the shared display currency the moment it changes,
// so the budget field's symbol + the entered-in hint update live. The choice is
// persisted to the DB on submit (below) and to this device via set().
const currencyModel = computed<CurrencyCode>({
  get: () => active.value,
  set: (code) => setCurrency(code)
})

async function submit() {
  const amount = Number(amountInput.value)
  if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
    error.value = 'Enter a monthly budget greater than 0.'
    return
  }
  // Back to base USD at the active rate — the storage convention for every amount.
  const usd = amount / rates.value[active.value]
  saving.value = true
  error.value = ''
  try {
    // Persist both the budget (base USD) and the chosen display currency so the
    // preference follows the user to any device, not just this browser.
    await $fetch('/api/settings', {
      method: 'PUT',
      body: { monthlyBudget: usd, currency: active.value }
    })
    toast.success(`Welcome to Vaulted — budget set to ${formatMoney(usd)}.`)
    emit('saved')
  } catch (err: unknown) {
    const body = (err as { data?: { statusMessage?: string; data?: { fieldErrors?: Record<string, string> } } })?.data
    error.value = body?.data?.fieldErrors?.monthlyBudget || body?.statusMessage || 'Could not save. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <!-- Teleport keeps the dialog outside the inert app root (see trap note
       above). Parent renders this inside ClientOnly, so no SSR mismatch. -->
  <Teleport to="body">
  <div
    ref="panel"
    tabindex="-1"
    class="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/60 p-4 outline-none backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="welcome-title"
  >
    <div class="glass-card animate-pop w-full max-w-md p-8">
      <p class="eyebrow mb-1">Welcome to Vaulted</p>
      <h2 id="welcome-title" class="font-display text-2xl font-bold text-ink">
        Set your monthly budget
      </h2>
      <p class="mt-2 text-sm text-ink-soft">
        One quick step. This is your monthly income limit — your balance, savings rate, and
        spending pace all track against it. You can change it anytime.
      </p>

      <form class="mt-6 space-y-4" novalidate @submit.prevent="submit">
        <div>
          <label for="welcome-currency" class="label">Currency</label>
          <select id="welcome-currency" v-model="currencyModel" class="field">
            <option v-for="o in CURRENCY_OPTIONS" :key="o.code" :value="o.code">
              {{ o.flag }} {{ o.symbol }} {{ o.code }} · {{ o.label }}
            </option>
          </select>
          <p class="mt-1 text-xs text-ink-faint">
            How every amount is shown. You can change it anytime.
          </p>
        </div>

        <div>
          <label for="welcome-budget" class="label">Monthly budget</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
            >
              {{ symbol }}
            </span>
            <input
              id="welcome-budget"
              v-model="amountInput"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-8 font-mono tnum"
              :class="{ 'field-invalid': error }"
              placeholder="0.00"
            />
          </div>
          <p v-if="error" class="mt-1 text-xs text-negative">{{ error }}</p>
          <p v-else-if="active !== 'USD'" class="mt-1 text-xs text-ink-faint">
            Entered in {{ active }} — stored in USD at today's rate, like every amount.
          </p>
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="saving">
          {{ saving ? 'Saving…' : 'Start tracking' }}
        </button>
      </form>
    </div>
  </div>
  </Teleport>
</template>
