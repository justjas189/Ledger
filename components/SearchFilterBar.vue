<script setup lang="ts">
// The toolbar above the expenses ledger: search box, category filter, and a
// date range. It keeps its own copies of the inputs and emits the whole filter
// object upward (search is debounced so we don't refetch on every keystroke).
import type { CategoryDTO, ExpenseFilters } from '~/types/expense'

const props = defineProps<{
  modelValue: ExpenseFilters
  categories: CategoryDTO[]
}>()

const emit = defineEmits<{
  'update:modelValue': [ExpenseFilters]
  clear: []
}>()

const search = ref(props.modelValue.search)
const categoryId = ref(props.modelValue.categoryId)
const from = ref(props.modelValue.from)
const to = ref(props.modelValue.to)

// If the parent resets the filters, mirror that back into our inputs.
watch(
  () => props.modelValue,
  (v) => {
    search.value = v.search
    categoryId.value = v.categoryId
    from.value = v.from
    to.value = v.to
  }
)

const emitAll = () =>
  emit('update:modelValue', {
    search: search.value,
    categoryId: categoryId.value,
    from: from.value,
    to: to.value
  })

// Debounce the free-text search; fire the others immediately.
let searchTimer: ReturnType<typeof setTimeout>
watch(search, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(emitAll, 300)
})
watch([categoryId, from, to], emitAll)

const hasFilters = computed(
  () => !!(search.value || categoryId.value || from.value || to.value)
)

const clearAll = () => {
  search.value = ''
  categoryId.value = ''
  from.value = ''
  to.value = ''
  emit('clear')
}
</script>

<template>
  <div class="card p-4 sm:p-5">
    <div class="grid gap-3 md:grid-cols-[1.4fr_1fr_auto]">
      <!-- Search -->
      <div>
        <label for="search" class="eyebrow mb-1.5 block">Search</label>
        <input
          id="search"
          v-model="search"
          type="search"
          class="field"
          placeholder="Search descriptions…"
        />
      </div>

      <!-- Category -->
      <div>
        <label for="filter-category" class="eyebrow mb-1.5 block">Category</label>
        <select id="filter-category" v-model="categoryId" class="field">
          <option value="">All categories</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">
            {{ c.icon ? c.icon + ' ' : '' }}{{ c.name }}
          </option>
        </select>
      </div>

      <!-- Date range -->
      <div>
        <label for="from" class="eyebrow mb-1.5 block">From / To</label>
        <div class="flex items-center gap-2">
          <input id="from" v-model="from" type="date" class="field font-mono tnum" />
          <span class="text-ink-soft" aria-hidden="true">–</span>
          <input id="to" v-model="to" type="date" class="field font-mono tnum" />
        </div>
      </div>
    </div>

    <div v-if="hasFilters" class="mt-3 flex justify-end">
      <button type="button" class="text-sm font-medium text-clay hover:underline" @click="clearAll">
        Clear filters
      </button>
    </div>
  </div>
</template>
