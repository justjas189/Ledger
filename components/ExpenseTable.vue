<script setup lang="ts">
// The expenses ledger — the visual signature of the app.
// Ruled rows, a running line number down the margin, and every figure set in
// tabular monospace so the amounts stack in a perfect column.
//
// Responsive: a real <table> on desktop, stacked cards on phones.
import { Pencil, Trash2 } from 'lucide-vue-next'
import type { ExpenseDTO } from '~/types/expense'

const props = withDefaults(
  defineProps<{
    expenses: ExpenseDTO[]
    currency: string
    loading?: boolean
    /** Line number of the first row (so numbering continues across pages). */
    startIndex?: number
  }>(),
  { loading: false, startIndex: 0 }
)

const emit = defineEmits<{ edit: [ExpenseDTO]; delete: [ExpenseDTO] }>()

const { formatMoney, formatDate } = useFormatters()

const showSkeleton = computed(() => props.loading && props.expenses.length === 0)
const showEmpty = computed(() => !props.loading && props.expenses.length === 0)
</script>

<template>
  <div class="card overflow-hidden">
    <!-- ── Loading skeleton ────────────────────────────────────────── -->
    <div v-if="showSkeleton" class="divide-y divide-edge">
      <div v-for="n in 6" :key="n" class="flex items-center gap-4 px-5 py-4">
        <div class="h-3 w-6 animate-pulse rounded bg-subtle" />
        <div class="h-3 w-24 animate-pulse rounded bg-subtle" />
        <div class="h-3 flex-1 animate-pulse rounded bg-subtle" />
        <div class="h-3 w-20 animate-pulse rounded bg-subtle" />
      </div>
    </div>

    <!-- ── Empty state ─────────────────────────────────────────────── -->
    <div v-else-if="showEmpty" class="px-6 py-16 text-center">
      <slot name="empty">
        <p class="font-display text-lg text-ink">No entries yet</p>
        <p class="mt-1 text-sm text-ink-soft">
          Add your first expense to start the ledger.
        </p>
      </slot>
    </div>

    <!-- ── Data ────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- Desktop: ledger table -->
      <table class="hidden w-full border-collapse text-sm md:table" :class="{ 'opacity-60': loading }">
        <thead>
          <tr class="double-rule text-left">
            <th class="w-10 px-3 py-3 text-right font-normal">
              <span class="eyebrow">#</span>
            </th>
            <th class="w-32 px-3 py-3"><span class="eyebrow">Date</span></th>
            <th class="px-3 py-3"><span class="eyebrow">Description</span></th>
            <th class="w-44 px-3 py-3"><span class="eyebrow">Category</span></th>
            <th class="w-32 px-3 py-3 text-right"><span class="eyebrow">Amount</span></th>
            <th class="w-24 px-3 py-3 text-right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(e, i) in expenses"
            :key="e.id"
            class="group border-b border-edge transition-colors last:border-0 even:bg-subtle/50 hover:bg-subtle"
          >
            <!-- running line number, like a ledger margin -->
            <td class="px-3 py-3 text-right align-middle font-mono text-xs text-ink-soft tnum">
              {{ startIndex + i + 1 }}
            </td>
            <td class="whitespace-nowrap px-3 py-3 align-middle font-mono text-ink-soft tnum">
              {{ formatDate(e.date) }}
            </td>
            <td class="px-3 py-3 align-middle font-medium text-ink">
              {{ e.description }}
            </td>
            <td class="px-3 py-3 align-middle">
              <CategoryPill
                v-if="e.category"
                :name="e.category.name"
                :color="e.category.color"
                :icon="e.category.icon"
                size="sm"
              />
            </td>
            <td class="whitespace-nowrap px-3 py-3 text-right align-middle font-mono font-semibold text-ink tnum">
              {{ formatMoney(e.amount, currency) }}
            </td>
            <td class="px-3 py-3 text-right align-middle">
              <div
                class="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              >
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-panel hover:text-ink"
                  :aria-label="`Edit ${e.description}`"
                  @click="emit('edit', e)"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:bg-panel hover:text-negative"
                  :aria-label="`Delete ${e.description}`"
                  @click="emit('delete', e)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Mobile: stacked cards -->
      <ul class="divide-y divide-edge md:hidden" :class="{ 'opacity-60': loading }">
        <li
          v-for="(e, i) in expenses"
          :key="e.id"
          class="flex items-start justify-between gap-3 px-4 py-4 even:bg-subtle/40"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-mono text-xs text-ink-soft tnum">{{ startIndex + i + 1 }}</span>
              <p class="truncate font-medium text-ink">{{ e.description }}</p>
            </div>
            <div class="mt-1.5 flex items-center gap-2">
              <CategoryPill
                v-if="e.category"
                :name="e.category.name"
                :color="e.category.color"
                :icon="e.category.icon"
                size="sm"
              />
              <span class="font-mono text-xs text-ink-soft tnum">{{ formatDate(e.date) }}</span>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <span class="whitespace-nowrap font-mono font-semibold text-ink tnum">
              {{ formatMoney(e.amount, currency) }}
            </span>
            <div class="flex gap-1">
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-lg border border-edge text-ink-soft"
                :aria-label="`Edit ${e.description}`"
                @click="emit('edit', e)"
              >
                <Pencil class="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                class="grid h-8 w-8 place-items-center rounded-lg border border-edge text-negative"
                :aria-label="`Delete ${e.description}`"
                @click="emit('delete', e)"
              >
                <Trash2 class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
