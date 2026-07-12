<script setup lang="ts">
// Lists every category the user owns, with a delete action per row.
//
// This is a direct request-and-respond delete, NOT the optimistic
// hide-then-undo pattern used for expenses/goals (see useOptimisticExpenses,
// SavingsGoals.vue) — deliberately. A 409 here is an expected, meaningful
// outcome ("this category still has expenses"), not a transient failure to
// silently roll back from, and reaching this action already takes an extra,
// deliberate step (open Manage → pick a row), unlike a swipeable list row.
import { Trash2, Loader2 } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { data: categories, deleteCategory } = useCategories()
const toast = useToast()

/** The id currently mid-delete — disables its row and shows a spinner. */
const deletingId = ref<string | null>(null)
/** Inline message per category id, shown directly under that row. */
const rowErrors = ref<Record<string, string>>({})

// A fresh look every time the dialog opens — no stale error from a previous
// visit lingering under a row.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    rowErrors.value = {}
  }
)

function close() {
  emit('close')
}

async function onDelete(category: { id: string; name: string }) {
  if (deletingId.value) return
  deletingId.value = category.id
  if (rowErrors.value[category.id]) {
    const next = { ...rowErrors.value }
    delete next[category.id]
    rowErrors.value = next
  }

  try {
    await deleteCategory(category.id)
    toast.success(`"${category.name}" deleted.`)
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode
    const message =
      statusCode === 409
        ? `"${category.name}" still has expenses — move or delete them first.`
        : 'Could not delete this category. Please try again.'
    rowErrors.value = { ...rowErrors.value, [category.id]: message }
    toast.error(message)
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <Modal :open="open" title="Manage categories" @close="close()">
    <ul v-if="categories.length" class="max-h-[60vh] -mx-1 space-y-1 overflow-y-auto">
      <li v-for="c in categories" :key="c.id" class="rounded-xl px-1">
        <div
          class="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 transition-colors
            hover:bg-black/5 dark:hover:bg-white/5"
        >
          <CategoryPill :name="c.name" :color="c.color" :icon="c.icon" />
          <button
            type="button"
            class="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint
              transition-colors hover:bg-negative/10 hover:text-negative
              disabled:cursor-not-allowed disabled:opacity-50"
            :aria-label="`Delete ${c.name}`"
            :disabled="deletingId === c.id"
            @click="onDelete(c)"
          >
            <Loader2
              v-if="deletingId === c.id"
              class="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <Trash2 v-else class="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p v-if="rowErrors[c.id]" class="px-2 pb-2 text-xs text-negative">{{ rowErrors[c.id] }}</p>
      </li>
    </ul>
    <p v-else class="py-6 text-center text-sm text-ink-faint">No categories yet.</p>

    <template #footer>
      <button type="button" class="btn btn-ghost" @click="close()">Done</button>
    </template>
  </Modal>
</template>
