<script setup lang="ts">
// Edit the monthly income / budget limit (see useMonthlyBudget).
// Same small Modal the savings-goals form uses, so the two money dialogs
// read as one family. The field works in the ACTIVE display currency —
// the symbol and the prefilled figure follow the dropdown — and converts
// back to base USD on save, the storage convention for every amount.
import { RotateCcw } from 'lucide-vue-next'
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'

const props = defineProps<{
  open: boolean
  /** The income currently in effect, base USD. */
  currentIncome: number
}>()

const emit = defineEmits<{ close: [] }>()

const { override, set, clear } = useMonthlyBudget()
const { active, rates, convert } = useCurrency()
const { formatMoney } = useFormatters()
const toast = useToast()

const amountInput = ref('')
const inputError = ref('')

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

function submit() {
  const amount = Number(amountInput.value)
  if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
    inputError.value = 'Enter a monthly budget greater than 0.'
    return
  }
  // Back to base USD at the same rate the prefill used.
  const usd = amount / rates.value[active.value]
  if (!set(usd)) {
    inputError.value = 'That amount could not be saved.'
    return
  }
  toast.success(`Monthly budget set to ${formatMoney(usd)}.`)
  emit('close')
}

function resetToDefault() {
  clear()
  toast.info('Monthly budget reset to the configured default.')
  emit('close')
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
      <button
        v-if="override !== null"
        type="button"
        class="btn btn-ghost mr-auto !px-3 text-xs"
        @click="resetToDefault()"
      >
        <RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
        Reset to default
      </button>
      <button type="button" class="btn btn-ghost" @click="emit('close')">Cancel</button>
      <button type="button" class="btn btn-primary" @click="submit()">Save budget</button>
    </template>
  </Modal>
</template>
