<script setup lang="ts">
// The expenses list.
// Rows cascade in with a staggered rise, and every figure is set in tabular
// monospace so the amounts stack in a clean column.
//
// Responsive: a real <table> on desktop, stacked cards on phones.
//
// Anomaly flags: entries sitting >3 MADs above their category's 90-day mean
// (see useAnomalies) carry a quiet amber "Unusual" pill next to the
// description — a guardian nudge, not an accusation.
import { Pencil, Trash2, TrendingUp } from 'lucide-vue-next'
import type { ExpenseDTO } from '~/types/expense'

const props = withDefaults(
  defineProps<{
    expenses: ExpenseDTO[]
    loading?: boolean
    /** Line number of the first row (so numbering continues across pages). */
    startIndex?: number
  }>(),
  { loading: false, startIndex: 0 }
)

const emit = defineEmits<{ edit: [ExpenseDTO]; delete: [ExpenseDTO] }>()

const { formatMoney, formatDate } = useFormatters()
const { anomalyFor } = useAnomalies()

const showSkeleton = computed(() => props.loading && props.expenses.length === 0)
const showEmpty = computed(() => !props.loading && props.expenses.length === 0)

// The pill's tooltip justifies the flag with the category's typical figure.
function anomalyTitle(e: ExpenseDTO) {
  const flag = anomalyFor(e)
  if (!flag) return ''
  return `Unusually high for ${e.category?.name ?? 'this category'} — a typical entry is about ${formatMoney(flag.mean)}.`
}

// --- Swipe-to-delete (mobile cards) -----------------------------------------
// Pointer events + `touch-action: pan-y`: the browser keeps vertical scroll,
// horizontal drags come to us. The card follows the finger to the left,
// revealing a delete affordance behind it; past the threshold, release
// triggers the same optimistic delete-with-undo as the trash button — the
// gesture is a shortcut, never the only path. Mouse users keep the buttons.
const SWIPE_THRESHOLD = 88 // px of leftward travel that commits the delete
const SWIPE_MAX = 160 // soft cap so the card can't fly off the screen

const swipe = reactive<{ id: string | null; dx: number; dragging: boolean }>({
  id: null,
  dx: 0,
  dragging: false
})
let startX = 0
let startY = 0

function onSwipeStart(e: PointerEvent, expense: ExpenseDTO) {
  if (e.pointerType === 'mouse') return
  startX = e.clientX
  startY = e.clientY
  swipe.id = expense.id
  swipe.dx = 0
  swipe.dragging = false
}

function onSwipeMove(e: PointerEvent, expense: ExpenseDTO) {
  if (swipe.id !== expense.id || e.pointerType === 'mouse') return
  const dx = e.clientX - startX
  const dy = e.clientY - startY
  if (!swipe.dragging) {
    // Wait for clear horizontal intent, otherwise let the page scroll.
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return
    swipe.dragging = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  swipe.dx = Math.max(Math.min(0, dx), -SWIPE_MAX) // leftward only
}

function onSwipeEnd(_e: PointerEvent, expense: ExpenseDTO) {
  if (swipe.id !== expense.id) return
  if (swipe.dragging && -swipe.dx >= SWIPE_THRESHOLD) {
    if ('vibrate' in navigator) navigator.vibrate(10)
    emit('delete', expense)
  }
  swipe.id = null
  swipe.dx = 0
  swipe.dragging = false
}

function swipeStyle(id: string) {
  if (swipe.id !== id || swipe.dx === 0) return undefined
  return {
    transform: `translateX(${swipe.dx}px)`,
    // Follow the finger 1:1 while dragging; the snap-back on release uses
    // the class transition (which reduced-motion zeroes globally).
    transition: swipe.dragging ? 'none' : undefined
  }
}
</script>

<template>
  <div class="glass-card overflow-hidden">
    <!-- ── Loading skeleton ────────────────────────────────────────── -->
    <!-- Row geometry matches the real table; the shimmer cascades down the
         rows in 50ms steps via --stagger (see .skeleton in main.css). -->
    <div v-if="showSkeleton" class="divide-y divide-edge/5" aria-hidden="true">
      <div
        v-for="n in 6"
        :key="n"
        class="flex items-center gap-4 px-6 py-4"
        :style="{ '--stagger': n - 1 }"
      >
        <div class="skeleton h-3 w-6" />
        <div class="skeleton h-3 w-24" />
        <div class="skeleton h-3 flex-1" />
        <div class="skeleton h-3 w-20" />
      </div>
    </div>

    <!-- ── Empty state ─────────────────────────────────────────────── -->
    <div v-else-if="showEmpty" class="px-6 py-16 text-center">
      <slot name="empty">
        <p class="font-display text-lg font-semibold text-ink">No entries yet</p>
        <p class="mt-1 text-sm text-ink-soft">
          Add your first expense to get started.
        </p>
      </slot>
    </div>

    <!-- ── Data ────────────────────────────────────────────────────── -->
    <template v-else>
      <!-- ≥ sm: table. The # and Category columns only join at md so the
           640–768px band isn't cramped; in that band the category pill rides
           inside the Description cell instead. Below sm the table is gone
           entirely — the stacked cards take over. -->
      <table
        class="hidden w-full border-collapse text-sm transition-opacity duration-200 sm:table"
        :class="{ 'opacity-50': loading }"
      >
        <thead>
          <tr class="border-b border-edge/10 text-left">
            <th class="hidden w-10 px-4 py-4 text-right font-normal md:table-cell">
              <span class="eyebrow">#</span>
            </th>
            <th class="w-28 px-3 py-4 md:w-32"><span class="eyebrow">Date</span></th>
            <th class="px-3 py-4"><span class="eyebrow">Description</span></th>
            <th class="hidden w-44 px-3 py-4 md:table-cell"><span class="eyebrow">Category</span></th>
            <th class="w-32 px-3 py-4 text-right"><span class="eyebrow">Amount</span></th>
            <th class="w-24 px-4 py-4 text-right"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <TransitionGroup tag="tbody" name="rows" appear>
          <tr
            v-for="(e, i) in expenses"
            :key="e.id"
            class="group border-b border-edge/5 transition-colors duration-200 last:border-0 hover:bg-edge/5"
            :style="{ '--i': i }"
          >
            <!-- running line number, continued across pages -->
            <td class="hidden px-4 py-3.5 text-right align-middle font-mono text-xs text-ink-faint tnum md:table-cell">
              {{ startIndex + i + 1 }}
            </td>
            <td class="whitespace-nowrap px-3 py-3.5 align-middle font-mono text-ink-soft tnum">
              {{ formatDate(e.date) }}
            </td>
            <td class="px-3 py-3.5 align-middle font-medium text-ink">
              <span class="inline-flex flex-wrap items-center gap-2">
                {{ e.description }}
                <!-- sm–md only: the dedicated Category column is hidden, so
                     the pill tags along with the description instead. -->
                <CategoryPill
                  v-if="e.category"
                  class="md:hidden"
                  :name="e.category.name"
                  :color="e.category.color"
                  :icon="e.category.icon"
                  size="sm"
                />
                <span
                  v-if="anomalyFor(e)"
                  class="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium text-amber-600 dark:text-amber-400"
                  :title="anomalyTitle(e)"
                  :aria-label="anomalyTitle(e)"
                >
                  <TrendingUp class="h-3 w-3" aria-hidden="true" />
                  Unusual
                </span>
              </span>
            </td>
            <td class="hidden px-3 py-3.5 align-middle md:table-cell">
              <CategoryPill
                v-if="e.category"
                :name="e.category.name"
                :color="e.category.color"
                :icon="e.category.icon"
                size="sm"
              />
            </td>
            <td class="whitespace-nowrap px-3 py-3.5 text-right align-middle font-mono font-semibold text-ink tnum">
              {{ formatMoney(e.amount) }}
            </td>
            <td class="px-4 py-3.5 text-right align-middle">
              <div
                class="flex justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
              >
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-edge/10 hover:text-ink"
                  :aria-label="`Edit ${e.description}`"
                  @click="emit('edit', e)"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors duration-150 hover:bg-negative/10 hover:text-negative"
                  :aria-label="`Delete ${e.description}`"
                  @click="emit('delete', e)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>

      <!-- < sm: stacked cards (swipe-left to delete; buttons remain). -->
      <TransitionGroup
        tag="ul"
        name="rows"
        appear
        class="divide-y divide-edge/5 transition-opacity duration-200 sm:hidden"
        :class="{ 'opacity-50': loading }"
      >
        <li
          v-for="(e, i) in expenses"
          :key="e.id"
          class="relative overflow-hidden"
          :style="{ '--i': i }"
        >
          <!-- Delete affordance revealed behind the sliding card. Its opacity
               tracks swipe progress so the intent reads before the commit. -->
          <div
            class="absolute inset-y-0 right-0 flex w-28 items-center justify-center bg-negative/15 text-negative"
            :style="{ opacity: swipe.id === e.id ? Math.min(1, -swipe.dx / SWIPE_THRESHOLD) : 0 }"
            aria-hidden="true"
          >
            <Trash2 class="h-5 w-5" />
          </div>

          <!-- The card content slides over the affordance. Solid background
               (matching the glass-card surface) so it fully covers it at rest.
               touch-pan-y keeps vertical scrolling native. -->
          <div
            class="relative flex touch-pan-y select-none items-start justify-between gap-3 bg-white px-5 py-4 transition-transform duration-300 dark:bg-zinc-900"
            :style="swipeStyle(e.id)"
            @pointerdown="onSwipeStart($event, e)"
            @pointermove="onSwipeMove($event, e)"
            @pointerup="onSwipeEnd($event, e)"
            @pointercancel="onSwipeEnd($event, e)"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-mono text-xs text-ink-faint tnum">{{ startIndex + i + 1 }}</span>
                <p class="truncate font-medium text-ink">{{ e.description }}</p>
              </div>
              <div class="mt-1.5 flex flex-wrap items-center gap-2">
                <CategoryPill
                  v-if="e.category"
                  :name="e.category.name"
                  :color="e.category.color"
                  :icon="e.category.icon"
                  size="sm"
                />
                <span class="font-mono text-xs text-ink-faint tnum">{{ formatDate(e.date) }}</span>
                <span
                  v-if="anomalyFor(e)"
                  class="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium text-amber-600 dark:text-amber-400"
                  :title="anomalyTitle(e)"
                  :aria-label="anomalyTitle(e)"
                >
                  <TrendingUp class="h-3 w-3" aria-hidden="true" />
                  Unusual
                </span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <span class="whitespace-nowrap font-mono font-semibold text-ink tnum">
                {{ formatMoney(e.amount) }}
              </span>
              <div class="flex gap-1">
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg border border-edge/10 bg-edge/5 text-ink-soft"
                  :aria-label="`Edit ${e.description}`"
                  @click="emit('edit', e)"
                >
                  <Pencil class="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  class="grid h-8 w-8 place-items-center rounded-lg border border-edge/10 bg-edge/5 text-negative"
                  :aria-label="`Delete ${e.description}`"
                  @click="emit('delete', e)"
                >
                  <Trash2 class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </li>
      </TransitionGroup>
    </template>
  </div>
</template>

<style scoped>
/* Rows cascade: each waits on its index (--i, set inline) before rising in. */
.rows-enter-active {
  transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: calc(var(--i, 0) * 45ms);
}
.rows-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.rows-leave-active {
  transition: opacity 0.15s ease;
}
.rows-leave-to {
  opacity: 0;
}
</style>
