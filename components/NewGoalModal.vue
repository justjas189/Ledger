<script setup lang="ts">
// Create-a-savings-bucket dialog. Split out of SavingsGoals so the card stays
// focused on display + the "add funds" flow. Two modes, one ledger:
//   • Targeted goal   — name + target + deadline, exactly the original form.
//     Target entered in the ACTIVE display currency (symbol + conversion, like
//     the budget modals); the deadline powers the card's countdown.
//   • Open-ended fund — name only (e.g. "Emergency Fund"): target/targetDate
//     stay null and the card shows a running balance instead of a ring %.
// Persists via the shared useSavingsGoals().addGoal.
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { active, rates } = useCurrency()
const { addGoal } = useSavingsGoals()
const { formatDateInput } = useFormatters()
const toast = useToast()

const symbol = computed(
  () => CURRENCY_OPTIONS.find((o) => o.code === active.value)?.symbol ?? '$'
)

// 'goal' = targeted (target + deadline); 'fund' = open-ended (name only).
const mode = ref<'goal' | 'fund'>('goal')
const nameInput = ref('')
const amountInput = ref('')
const dateInput = ref('')
const errors = ref<Record<string, string>>({})
const saving = ref(false)

// Today (min for the deadline) and a sensible default three months out.
const today = computed(() => formatDateInput(new Date()))
function defaultDeadline(): string {
  const d = new Date()
  d.setMonth(d.getMonth() + 3)
  return formatDateInput(d)
}

// Reset every time the dialog opens so a cancelled draft never lingers.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    mode.value = 'goal'
    nameInput.value = ''
    amountInput.value = ''
    dateInput.value = defaultDeadline()
    errors.value = {}
  }
)

// Switching modes clears errors from fields the new mode doesn't have.
watch(mode, () => {
  errors.value = {}
})

function close() {
  if (saving.value) return
  emit('close')
}

async function submit() {
  if (saving.value) return
  const next: Record<string, string> = {}
  const amount = Number(amountInput.value)
  if (!nameInput.value.trim()) next.name = 'Give it a name.'
  if (mode.value === 'goal') {
    if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
      next.target = 'Enter a target greater than 0.'
    }
    if (!dateInput.value) next.targetDate = 'Choose a target date.'
  }
  errors.value = next
  if (Object.keys(next).length) return

  saving.value = true
  try {
    if (mode.value === 'goal') {
      // Entered in the active display currency → back to base USD at today's rate.
      const usd = amount / rates.value[active.value]
      await addGoal(nameInput.value, { target: usd, targetDate: dateInput.value })
      toast.success('Goal added — start filling the ring.')
    } else {
      await addGoal(nameInput.value)
      toast.success('Fund created — every deposit builds the balance.')
    }
    emit('close')
  } catch (err: unknown) {
    const fieldErrors = (err as { data?: { data?: { fieldErrors?: Record<string, string> } } })?.data
      ?.data?.fieldErrors
    errors.value = fieldErrors ?? { target: 'Could not save. Please try again.' }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="open" title="New savings" @close="close()">
    <form class="space-y-5" novalidate @submit.prevent="submit">
      <!-- Mode toggle: targeted goal vs open-ended fund -->
      <div>
        <span class="label">Type</span>
        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Savings type">
          <button
            type="button"
            role="radio"
            :aria-checked="mode === 'goal'"
            class="rounded-lg border px-3 py-2 text-left transition-colors duration-150"
            :class="
              mode === 'goal'
                ? 'border-accent-strong/40 bg-accent-strong/10'
                : 'border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10'
            "
            @click="mode = 'goal'"
          >
            <span class="block text-sm font-medium text-ink">Targeted goal</span>
            <span class="block text-xs text-ink-faint">An amount by a date</span>
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="mode === 'fund'"
            class="rounded-lg border px-3 py-2 text-left transition-colors duration-150"
            :class="
              mode === 'fund'
                ? 'border-accent-strong/40 bg-accent-strong/10'
                : 'border-black/10 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10'
            "
            @click="mode = 'fund'"
          >
            <span class="block text-sm font-medium text-ink">Open-ended fund</span>
            <span class="block text-xs text-ink-faint">No finish line</span>
          </button>
        </div>
      </div>

      <div>
        <label for="goal-name" class="label">Name</label>
        <input
          id="goal-name"
          v-model="nameInput"
          type="text"
          class="field"
          :class="{ 'field-invalid': errors.name }"
          :placeholder="mode === 'goal' ? 'e.g. New Laptop' : 'e.g. Emergency Fund'"
          maxlength="60"
        />
        <p v-if="errors.name" class="mt-1 text-xs text-negative">{{ errors.name }}</p>
      </div>

      <template v-if="mode === 'goal'">
        <div>
          <label for="goal-target" class="label">Target amount</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
            >
              {{ symbol }}
            </span>
            <input
              id="goal-target"
              v-model="amountInput"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-8 font-mono tnum"
              :class="{ 'field-invalid': errors.target }"
              placeholder="0.00"
            />
          </div>
          <p v-if="errors.target" class="mt-1 text-xs text-negative">{{ errors.target }}</p>
          <p v-else-if="active !== 'USD'" class="mt-1 text-xs text-ink-faint">
            Entered in {{ active }} — stored in USD at today's rate, like every amount.
          </p>
        </div>

        <div>
          <label for="goal-date" class="label">Target date</label>
          <input
            id="goal-date"
            v-model="dateInput"
            type="date"
            :min="today"
            class="field font-mono tnum"
            :class="{ 'field-invalid': errors.targetDate }"
          />
          <p v-if="errors.targetDate" class="mt-1 text-xs text-negative">{{ errors.targetDate }}</p>
          <p v-else class="mt-1 text-xs text-ink-faint">The deadline you're aiming for.</p>
        </div>
      </template>

      <p v-else class="text-xs text-ink-faint">
        A fund has no target or deadline — deposits simply build its balance. You can turn it
        into a targeted goal later.
      </p>
    </form>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="close()">Cancel</button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="submit()">
        {{ saving ? 'Saving…' : mode === 'goal' ? 'Add goal' : 'Create fund' }}
      </button>
    </template>
  </Modal>
</template>
