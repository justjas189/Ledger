<script setup lang="ts">
// Expenses — the full list with search, filters, pagination, and CRUD.
// This page owns all the interaction state: the current filters, the page
// number, and whether the edit drawer is open.
// All fetching and payloads are unchanged from Ledger — the API is locked.
//
// Deletes are optimistic: the row vanishes the moment the trash icon is
// pressed and a 5s "Undo" toast holds the real DELETE back (see
// useOptimisticExpenses). No confirm dialog — undo replaces it.
import type { ExpenseDTO, ExpenseFilters, ExpenseListResponse } from '~/types/expense'

useHead({ title: 'Expenses · Vaulted' })

const { data: categories } = useCategories()
const { pendingAdds, hiddenIds, scheduleDelete } = useOptimisticExpenses()
const { open: openQuickAdd } = useQuickAdd()

const PAGE_SIZE = 10

// --- List query state -------------------------------------------------------
const filters = ref<ExpenseFilters>({ search: '', categoryId: '', from: '', to: '' })
const page = ref(1)

// The query object is reactive, so useFetch automatically refetches whenever
// the filters or page change.
const query = computed(() => ({
  page: page.value,
  pageSize: PAGE_SIZE,
  search: filters.value.search || undefined,
  categoryId: filters.value.categoryId || undefined,
  from: filters.value.from || undefined,
  to: filters.value.to || undefined
}))

// The explicit 'expenses' key lets mutation sites refresh this list by name
// (refreshSpendingCaches) — the reactive query still refetches on change.
const { data, pending, error, refresh } = useFetch<ExpenseListResponse>('/api/expenses', {
  key: 'expenses',
  query,
  lazy: true,
  server: false,
  default: () => ({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 })
})

const hasActiveFilters = computed(
  () => !!(filters.value.search || filters.value.categoryId || filters.value.from || filters.value.to)
)
const startIndex = computed(() => ((data.value?.page ?? 1) - 1) * PAGE_SIZE)

// What the table actually shows: server rows minus rows inside their undo
// window, with optimistic adds on top of page 1 (where new entries land
// after the refetch anyway — newest first).
const visibleItems = computed(() => {
  const serverRows = (data.value?.items ?? []).filter((e) => !hiddenIds.value.includes(e.id))
  if (page.value !== 1) return serverRows
  return [...pendingAdds.value, ...serverRows]
})

function onFilters(next: ExpenseFilters) {
  filters.value = next
  page.value = 1 // any filter change sends us back to the first page
}
function onClear() {
  filters.value = { search: '', categoryId: '', from: '', to: '' }
  page.value = 1
}

// --- Edit drawer --------------------------------------------------------------
// Creating goes through the global quick-add drawer (hosted by the layout and
// opened by the dock's "+" or the "N" shortcut); the local form instance here
// is for editing only.
const showForm = ref(false)
const editing = ref<ExpenseDTO | null>(null)

function openEdit(expense: ExpenseDTO) {
  editing.value = expense
  showForm.value = true
}

// --- Optimistic delete ------------------------------------------------------
function onDelete(expense: ExpenseDTO) {
  scheduleDelete(expense, () => {
    // scheduleDelete already refreshed every spending cache (stats, this
    // list, forecast) before this runs, so the deleted row is gone from
    // `data`. One local concern remains: removing the only row of a later
    // page leaves it empty — step back one page (the reactive query
    // refetches).
    if (data.value && data.value.items.length === 0 && page.value > 1) {
      page.value -= 1
    }
  })
}
</script>

<template>
  <div>
    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="animate-rise">
      <h1 class="font-display text-3xl font-bold tracking-tight text-ink">Expenses</h1>
      <p class="mt-1 text-sm text-ink-soft">
        Every entry — search, filter, edit, or remove.
      </p>
      <div class="hairline mt-6" />
    </div>

    <!-- ── Filters ──────────────────────────────────────────────────── -->
    <div class="animate-rise mt-6" style="animation-delay: 0.1s">
      <SearchFilterBar
        :model-value="filters"
        :categories="categories || []"
        @update:model-value="onFilters"
        @clear="onClear"
      />
    </div>

    <!-- ── Error state ──────────────────────────────────────────────── -->
    <div v-if="error" class="glass-card mt-6 p-8 text-center">
      <p class="font-display text-lg font-semibold text-ink">Couldn't load expenses</p>
      <p class="mt-1 text-sm text-ink-soft">Make sure the database is running, then try again.</p>
      <button type="button" class="btn btn-ghost mt-4" @click="refresh()">Retry</button>
    </div>

    <!-- ── The list ─────────────────────────────────────────────────── -->
    <template v-else>
      <div class="animate-rise mt-6" style="animation-delay: 0.18s">
        <ExpenseTable
          :expenses="visibleItems"
          :loading="pending"
          :start-index="startIndex"
          @edit="openEdit"
          @delete="onDelete"
        >
          <template #empty>
            <!-- Filtered-empty: the data exists, the filters excluded it. -->
            <template v-if="hasActiveFilters">
              <p class="font-display text-lg font-semibold text-ink">
                No entries match your filters
              </p>
              <p class="mt-1 text-sm text-ink-soft">
                Try a different search, category, or date range.
              </p>
              <button type="button" class="btn btn-ghost mt-5" @click="onClear">
                Clear filters
              </button>
            </template>
            <!-- First-run: nothing tracked yet — point at the one action. -->
            <template v-else>
              <p class="font-display text-lg font-semibold text-ink">No entries yet</p>
              <p class="mt-1 text-sm text-ink-soft">
                Your spending story starts with a single entry.
              </p>
              <button type="button" class="btn btn-primary mt-5" @click="openQuickAdd()">
                Add your first expense
              </button>
            </template>
          </template>
        </ExpenseTable>
      </div>

      <!-- ── Pagination ─────────────────────────────────────────────── -->
      <div v-if="data && data.total > 0" class="mt-5">
        <Pagination
          :page="data.page"
          :total-pages="data.totalPages"
          :total="data.total"
          :page-size="data.pageSize"
          @update:page="(p) => (page = p)"
        />
      </div>
    </template>

    <!-- ── Overlays ─────────────────────────────────────────────────────
         No @saved wiring: the form busts the 'expenses' key itself on a
         successful save (refreshSpendingCaches), so a listener here would
         just double-fetch the list. -->
    <ExpenseForm
      :open="showForm"
      :editing="editing"
      @close="showForm = false"
    />
  </div>
</template>
