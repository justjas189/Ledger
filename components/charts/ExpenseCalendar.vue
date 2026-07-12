<script setup lang="ts">
// Interactive expense calendar.
// A month grid (Monday-first); days that have recorded expenses carry a
// subtle accent dot. Clicking a day opens a summary card underneath: the
// day's total plus that day's transactions, each with its coloured category
// icon. Arrows step between months; forward stops at the current month.
//
// Data comes from the existing (locked) GET /api/expenses endpoint — the
// visible month is fetched once, paged through if needed, grouped by local
// calendar day here, and cached per month so stepping back and forth is free.
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { ExpenseDTO, ExpenseListResponse } from '~/types/expense'

const { formatMoney, formatDateInput, formatMonthLabel } = useFormatters()
const { categoryColor, withAlpha } = useCategoryColors()
const { resolveIcon, getCategoryIcon } = useCategoryIcons()

const today = new Date()
const todayKey = formatDateInput(today)

// First day of the month currently on screen.
const cursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const monthKey = computed(
  () => `${cursor.value.getFullYear()}-${String(cursor.value.getMonth() + 1).padStart(2, '0')}`
)
const isCurrentMonth = computed(
  () =>
    cursor.value.getFullYear() === today.getFullYear() &&
    cursor.value.getMonth() === today.getMonth()
)

// --- Month data: fetch once, cache forever (per session) ---------------------
const cache = new Map<string, ExpenseDTO[]>()
const monthExpenses = ref<ExpenseDTO[]>([])
const loading = ref(false)
const loadError = ref(false)

async function loadMonth() {
  const key = monthKey.value
  const cached = cache.get(key)
  if (cached) {
    monthExpenses.value = cached
    return
  }
  loading.value = true
  loadError.value = false
  try {
    const y = cursor.value.getFullYear()
    const m = cursor.value.getMonth()
    // Fetch one day beyond each edge so timezone offsets at the boundaries
    // can't drop entries; grouping below is by LOCAL day, which discards any
    // spill into neighbouring months.
    const from = formatDateInput(new Date(y, m, 0))
    const to = formatDateInput(new Date(y, m + 1, 1))
    const items: ExpenseDTO[] = []
    for (let page = 1; page <= 10; page++) {
      const res = await $fetch<ExpenseListResponse>('/api/expenses', {
        query: { from, to, page, pageSize: 50 }
      })
      items.push(...res.items)
      if (page >= res.totalPages) break
    }
    cache.set(key, items)
    if (key === monthKey.value) monthExpenses.value = items
  } catch {
    loadError.value = true
    monthExpenses.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadMonth)
watch(cursor, loadMonth)

// Per-day rollup for the visible month: "YYYY-MM-DD" → { total, items }.
const byDay = computed(() => {
  const map = new Map<string, { total: number; items: ExpenseDTO[] }>()
  for (const e of monthExpenses.value) {
    const key = formatDateInput(e.date)
    if (!key.startsWith(monthKey.value)) continue
    const entry = map.get(key) ?? { total: 0, items: [] }
    entry.total += e.amount
    entry.items.push(e)
    map.set(key, entry)
  }
  return map
})

// --- The grid -----------------------------------------------------------------
interface DayCell {
  key: string
  day: number
  total: number
  isToday: boolean
  isFuture: boolean
}

const cells = computed<DayCell[]>(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: daysInMonth }, (_, i) => {
    const key = `${monthKey.value}-${String(i + 1).padStart(2, '0')}`
    return {
      key,
      day: i + 1,
      total: byDay.value.get(key)?.total ?? 0,
      isToday: key === todayKey,
      isFuture: key > todayKey
    }
  })
})

// Blank cells before day 1, so the grid starts on the right weekday (Mon-first).
const leadingBlanks = computed(() => (cursor.value.getDay() + 6) % 7)

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

// --- Selection + day summary ---------------------------------------------------
const selected = ref<string | null>(todayKey)

const selectedSummary = computed(() => {
  if (!selected.value) return null
  const entry = byDay.value.get(selected.value)
  return {
    key: selected.value,
    total: entry?.total ?? 0,
    items: entry?.items ?? []
  }
})

const selectedLabel = computed(() => {
  if (!selected.value) return ''
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(`${selected.value}T00:00:00`))
})

function stepMonth(delta: number) {
  const next = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1)
  if (delta > 0 && next > today) return
  cursor.value = next
  // Selection follows the visible month: today when on the current month,
  // otherwise cleared until a day is picked.
  selected.value = isCurrentMonth.value ? todayKey : null
}

// Human-readable day announcement ("Tuesday 8 July, spent ₱420") — screen
// readers get the date in words, not the raw YYYY-MM-DD key.
function dayAriaLabel(c: DayCell): string {
  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(`${c.key}T00:00:00`))
  return `${date}${c.total > 0 ? `, spent ${formatMoney(c.total)}` : ', no expenses'}`
}
</script>

<template>
  <div>
    <!-- Month navigation -->
    <div class="flex items-center justify-between">
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-lg border border-edge/10 bg-edge/5 text-ink-soft transition-colors duration-150 hover:text-ink"
        aria-label="Previous month"
        @click="stepMonth(-1)"
      >
        <ChevronLeft class="h-4 w-4" aria-hidden="true" />
      </button>
      <p class="font-mono text-sm font-medium text-ink tnum">
        {{ formatMonthLabel(cursor) }}
      </p>
      <button
        type="button"
        class="grid h-8 w-8 place-items-center rounded-lg border border-edge/10 bg-edge/5 text-ink-soft transition-colors duration-150 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next month"
        :disabled="isCurrentMonth"
        @click="stepMonth(1)"
      >
        <ChevronRight class="h-4 w-4" aria-hidden="true" />
      </button>
    </div>

    <!-- Weekday header -->
    <div class="mt-3 grid grid-cols-7 gap-1 text-center" aria-hidden="true">
      <span v-for="d in weekdays" :key="d" class="font-mono text-[0.6rem] text-ink-faint">
        {{ d }}
      </span>
    </div>

    <!-- Day grid -->
    <div v-if="loading" class="mt-1 grid grid-cols-7 gap-1" aria-hidden="true">
      <div
        v-for="n in 35"
        :key="n"
        class="skeleton aspect-square"
        :style="{ '--stagger': (n - 1) % 7 }"
      />
    </div>
    <!-- role=group (not grid): these are plain toggle buttons, not a 2D
         navigable ARIA grid — claiming grid without rows/gridcells would
         promise arrow-key semantics that don't exist. -->
    <div v-else class="mt-1 grid grid-cols-7 gap-1" role="group" aria-label="Expense calendar: pick a day to see its transactions">
      <span v-for="n in leadingBlanks" :key="`blank-${n}`" aria-hidden="true" />
      <button
        v-for="c in cells"
        :key="c.key"
        type="button"
        class="group relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors duration-150"
        :class="[
          selected === c.key
            ? 'bg-accent/15 font-semibold text-accent-strong ring-1 ring-accent-strong/40'
            : c.isFuture
              ? 'text-ink-faint/50'
              : 'text-ink-soft hover:bg-edge/5 hover:text-ink',
          c.isToday && selected !== c.key && 'ring-1 ring-edge/20'
        ]"
        :disabled="c.isFuture"
        :aria-pressed="selected === c.key"
        :aria-label="dayAriaLabel(c)"
        @click="selected = c.key"
      >
        <span class="font-mono tnum">{{ c.day }}</span>
        <!-- The indicator dot: present only on days with recorded expenses. -->
        <span
          class="mt-0.5 h-1 w-1 rounded-full transition-colors"
          :class="c.total > 0 ? 'bg-accent' : 'bg-transparent'"
          aria-hidden="true"
        />
      </button>
    </div>

    <p v-if="loadError" class="mt-3 text-xs text-negative">
      Couldn't load this month's entries — check the database and try again.
    </p>

    <!-- Day summary card. aria-live: picking a day announces its summary
         without moving focus away from the grid. -->
    <div
      v-if="selectedSummary"
      :key="selectedSummary.key"
      class="animate-pop mt-4 rounded-2xl border border-edge/10 bg-edge/5 p-4"
      aria-live="polite"
    >
      <div class="flex items-baseline justify-between gap-3">
        <p class="text-sm font-semibold text-ink">{{ selectedLabel }}</p>
        <p class="font-mono text-sm font-semibold text-ink tnum">
          {{ formatMoney(selectedSummary.total) }}
        </p>
      </div>

      <ul v-if="selectedSummary.items.length" class="mt-3 space-y-2">
        <li
          v-for="e in selectedSummary.items"
          :key="e.id"
          class="flex items-center justify-between gap-3"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <!-- Coloured circular category icon, banking-app style. -->
            <span
              class="grid h-7 w-7 shrink-0 place-items-center rounded-full"
              :style="{
                backgroundColor: withAlpha(
                  categoryColor(e.category?.name ?? '', e.category?.color),
                  0.16
                )
              }"
              aria-hidden="true"
            >
              <component
                :is="resolveIcon(e.category?.icon) ?? resolveIcon(getCategoryIcon(e.category?.name ?? ''))"
                v-if="resolveIcon(e.category?.icon) ?? resolveIcon(getCategoryIcon(e.category?.name ?? ''))"
                class="h-3.5 w-3.5"
                :style="{ color: categoryColor(e.category?.name ?? '', e.category?.color) }"
              />
              <span
                v-else
                class="h-2 w-2 rounded-full"
                :style="{
                  backgroundColor: categoryColor(e.category?.name ?? '', e.category?.color)
                }"
              />
            </span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-ink">{{ e.description }}</p>
              <p class="text-xs text-ink-faint">{{ e.category?.name ?? 'Uncategorised' }}</p>
            </div>
          </div>
          <span class="whitespace-nowrap font-mono text-sm font-semibold text-ink tnum">
            {{ formatMoney(e.amount) }}
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 text-xs text-ink-faint">No expenses recorded on this day.</p>
    </div>
    <p v-else class="mt-4 text-center text-xs text-ink-faint">
      Select a day to see its transactions.
    </p>
  </div>
</template>
