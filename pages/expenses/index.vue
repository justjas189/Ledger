<script setup lang="ts">
// Expenses — the full list with search, filters, pagination, and CRUD.
// This page owns all the interaction state: the current filters, the page
// number, and which modal (add/edit or delete-confirm) is open.
import { Plus } from 'lucide-vue-next'
import type { ExpenseDTO, ExpenseFilters, ExpenseListResponse } from '~/types/expense'

useHead({ title: 'Expenses · Ledger' })

const toast = useToast()
const { data: categories } = useCategories()

const PAGE_SIZE = 10
const currency = 'USD' // matches the server's default; see /api/stats

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

const { data, pending, error, refresh } = useFetch<ExpenseListResponse>('/api/expenses', {
  query,
  lazy: true,
  server: false,
  default: () => ({ items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 })
})

const hasActiveFilters = computed(
  () => !!(filters.value.search || filters.value.categoryId || filters.value.from || filters.value.to)
)
const startIndex = computed(() => ((data.value?.page ?? 1) - 1) * PAGE_SIZE)

function onFilters(next: ExpenseFilters) {
  filters.value = next
  page.value = 1 // any filter change sends us back to the first page
}
function onClear() {
  filters.value = { search: '', categoryId: '', from: '', to: '' }
  page.value = 1
}

// --- Add / edit modal -------------------------------------------------------
const showForm = ref(false)
const editing = ref<ExpenseDTO | null>(null)

function openCreate() {
  editing.value = null
  showForm.value = true
}
function openEdit(expense: ExpenseDTO) {
  editing.value = expense
  showForm.value = true
}

// --- Delete confirmation ----------------------------------------------------
const deleteTarget = ref<ExpenseDTO | null>(null)
const deleting = ref(false)

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await $fetch(`/api/expenses/${deleteTarget.value.id}`, { method: 'DELETE' })
    toast.success('Entry deleted.')
    // If we just removed the only row on a later page, step back one page
    // (which refetches); otherwise refresh the current page in place.
    if (data.value && data.value.items.length === 1 && page.value > 1) {
      page.value -= 1
    } else {
      await refresh()
    }
    deleteTarget.value = null
  } catch (err: unknown) {
    const body = (err as { data?: { statusMessage?: string } })?.data
    toast.error(body?.statusMessage || 'Could not delete this entry. Please try again.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div>
    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl font-semibold tracking-tight text-ink">Expenses</h1>
        <p class="mt-1 text-sm text-ink-soft">
          Every entry in the book — search, filter, edit, or remove.
        </p>
      </div>
      <button type="button" class="btn btn-primary" @click="openCreate">
        <Plus class="h-4 w-4" aria-hidden="true" /> Add expense
      </button>
    </div>
    <div class="mt-5 double-rule" />

    <!-- ── Filters ──────────────────────────────────────────────────── -->
    <div class="mt-6">
      <SearchFilterBar
        :model-value="filters"
        :categories="categories || []"
        @update:model-value="onFilters"
        @clear="onClear"
      />
    </div>

    <!-- ── Error state ──────────────────────────────────────────────── -->
    <div v-if="error" class="card mt-6 p-8 text-center">
      <p class="font-display text-lg text-ink">Couldn't load expenses</p>
      <p class="mt-1 text-sm text-ink-soft">Make sure the database is running, then try again.</p>
      <button type="button" class="btn btn-ghost mt-4" @click="refresh()">Retry</button>
    </div>

    <!-- ── The ledger ───────────────────────────────────────────────── -->
    <template v-else>
      <div class="mt-6">
        <ExpenseTable
          :expenses="data?.items || []"
          :currency="currency"
          :loading="pending"
          :start-index="startIndex"
          @edit="openEdit"
          @delete="(e) => (deleteTarget = e)"
        >
          <template #empty>
            <p class="font-display text-lg text-ink">
              {{ hasActiveFilters ? 'No entries match your filters' : 'No entries yet' }}
            </p>
            <p class="mt-1 text-sm text-ink-soft">
              {{
                hasActiveFilters
                  ? 'Try a different search, category, or date range.'
                  : 'Add your first expense to start the ledger.'
              }}
            </p>
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

    <!-- ── Modals ───────────────────────────────────────────────────── -->
    <ExpenseForm
      :open="showForm"
      :editing="editing"
      @close="showForm = false"
      @saved="refresh()"
    />

    <ConfirmDialog
      :open="deleteTarget !== null"
      title="Delete this entry?"
      :message="
        deleteTarget
          ? `“${deleteTarget.description}” will be permanently removed from the ledger.`
          : ''
      "
      confirm-label="Delete entry"
      :busy="deleting"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
