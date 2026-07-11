<script setup lang="ts">
// Edit the monthly income / budget limit. Persists to the DB via
// PUT /api/settings (Profile.monthlyBudget) — the value used to live in
// localStorage; multi-tenant moved it server-side. The field works in the
// ACTIVE display currency (symbol + prefill follow the dropdown) and converts
// back to base USD on save, the storage convention for every amount.
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'

const props = defineProps<{
  open: boolean
  /** The income currently in effect, base USD. */
  currentIncome: number
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { active, rates, convert } = useCurrency()
const { formatMoney } = useFormatters()
const toast = useToast()

const amountInput = ref('')
const inputError = ref('')
const saving = ref(false)

const symbol = computed(
  () => CURRENCY_OPTIONS.find((o) => o.code === active.value)?.symbol ?? '$'
)

// Prefill with the effective income expressed in the display currency, so
// what the user sees is what the dashboard shows.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    inputError.value = ''
    amountInput.value =
      props.currentIncome > 0 ? String(Math.round(convert(props.currentIncome) * 100) / 100) : ''
  }
)

async function submit() {
  const amount = Number(amountInput.value)
  if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
    inputError.value = 'Enter a monthly budget greater than 0.'
    return
  }
  // Back to base USD at the same rate the prefill used.
  const usd = amount / rates.value[active.value]
  saving.value = true
  inputError.value = ''
  try {
    await $fetch('/api/settings', { method: 'PUT', body: { monthlyBudget: usd } })
    toast.success(`Monthly budget set to ${formatMoney(usd)}.`)
    emit('saved')
    emit('close')
  } catch (err: unknown) {
    const body = (err as { data?: { data?: { fieldErrors?: Record<string, string> } } })?.data
    inputError.value = body?.data?.fieldErrors?.monthlyBudget || 'That amount could not be saved.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="open" title="Monthly budget" @close="emit('close')">
    <form class="space-y-5" novalidate @submit.prevent="submit">
      <p class="text-sm text-ink-soft">
        Your income limit for the month — balance and savings rate follow it instantly.
      </p>

      <div>
        <label for="budget-amount" class="label">Monthly income / budget</label>
        <div class="relative">
          <span
            class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
          >
            {{ symbol }}
          </span>
          <input
            id="budget-amount"
            v-model="amountInput"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0"
            class="field pl-8 font-mono tnum"
            :class="{ 'field-invalid': inputError }"
            placeholder="0.00"
          />
        </div>
        <p v-if="inputError" class="mt-1 text-xs text-negative">{{ inputError }}</p>
        <p v-else-if="active !== 'USD'" class="mt-1 text-xs text-ink-faint">
          Entered in {{ active }} — stored in USD at today's rate, like every amount.
        </p>
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="emit('close')">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="submit()">
        {{ saving ? 'Saving…' : 'Save budget' }}
      </button>
    </template>
  </Modal>
</template>
