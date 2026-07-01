<script setup lang="ts">
// The add / edit expense form, shown inside a modal.
// One component handles BOTH creating and editing: if an `editing` expense is
// passed in we pre-fill the fields and PUT on save; otherwise we start blank
// and POST. The parent owns whether the modal is open.
import type { ExpenseDTO } from '~/types/expense'

const props = defineProps<{
  open: boolean
  editing: ExpenseDTO | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { data: categories } = useCategories()
const { formatDateInput } = useFormatters()
const toast = useToast()

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

// (Re)fill the form whenever the modal opens.
function resetForm() {
  clearErrors()
  if (props.editing) {
    form.description = props.editing.description
    form.amount = String(props.editing.amount)
    form.date = formatDateInput(props.editing.date)
    form.categoryId = props.editing.categoryId
  } else {
    form.description = ''
    form.amount = ''
    form.date = formatDateInput(new Date()) // default to today
    form.categoryId = categories.value?.[0]?.id ?? ''
  }
}

watch(() => props.open, (open) => open && resetForm())
// If categories arrive after the form opened, pick a sensible default.
watch(categories, (list) => {
  if (props.open && !props.editing && !form.categoryId) {
    form.categoryId = list?.[0]?.id ?? ''
  }
})

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

async function submit() {
  if (!validate()) return
  saving.value = true
  try {
    const payload = {
      description: form.description.trim(),
      amount: Number(form.amount),
      // Parse as LOCAL midnight so the saved day matches what the user picked.
      date: new Date(`${form.date}T00:00:00`).toISOString(),
      categoryId: form.categoryId
    }

    if (isEdit.value) {
      await $fetch(`/api/expenses/${props.editing!.id}`, { method: 'PUT', body: payload })
      toast.success('Changes saved.')
    } else {
      await $fetch('/api/expenses', { method: 'POST', body: payload })
      toast.success('Expense added.')
    }

    emit('saved')
    emit('close')
  } catch (err: unknown) {
    // The server sends field-level messages under data.fieldErrors on a 400.
    const body = (err as { data?: { statusMessage?: string; message?: string; data?: { fieldErrors?: Record<string, string> } } })?.data
    const fieldErrors = body?.data?.fieldErrors
    if (fieldErrors) {
      Object.assign(errors, fieldErrors)
    } else {
      toast.error(body?.statusMessage || 'Could not save this expense. Please try again.')
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit expense' : 'Add expense'"
    @close="emit('close')"
  >
    <form class="space-y-4" novalidate @submit.prevent="submit">
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
        <p v-if="errors.description" class="mt-1 text-xs text-clay">{{ errors.description }}</p>
      </div>

      <!-- Amount + Date, side by side on wider screens -->
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label for="amount" class="label">Amount</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3 grid place-items-center font-mono text-sm text-ink-soft"
            >
              $
            </span>
            <input
              id="amount"
              v-model="form.amount"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-7 font-mono tnum"
              :class="{ 'field-invalid': errors.amount }"
              placeholder="0.00"
            />
          </div>
          <p v-if="errors.amount" class="mt-1 text-xs text-clay">{{ errors.amount }}</p>
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
          <p v-if="errors.date" class="mt-1 text-xs text-clay">{{ errors.date }}</p>
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
        >
          <option value="" disabled>Choose a category…</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.icon ? c.icon + ' ' : '' }}{{ c.name }}
          </option>
        </select>
        <p v-if="errors.categoryId" class="mt-1 text-xs text-clay">{{ errors.categoryId }}</p>
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
  </Modal>
</template>
