<script setup lang="ts">
// Daily totals — a plain bar chart, one bar per day.
// Bars are the single accent hue (today at full strength, the rest softened);
// magnitude is the only message, so no hue carousel. A 7-day / 30-day switch
// keeps the view either "this week at a glance" or "the whole month's shape".
import type { DailyTrendPoint } from '~/types/expense'

const props = defineProps<{
  points: DailyTrendPoint[]
}>()

const { formatMoney, formatDate } = useFormatters()

const range = ref<7 | 30>(7)

const visible = computed(() => props.points.slice(-range.value))

const maxTotal = computed(() =>
  visible.value.reduce((m, p) => Math.max(m, p.total), 0)
)

const rangeTotal = computed(() => visible.value.reduce((s, p) => s + p.total, 0))
const rangeAvg = computed(() =>
  visible.value.length ? rangeTotal.value / visible.value.length : 0
)

/** Bar height as a % of the chart. Zero days keep a visible 2px stub. */
function heightPct(total: number): number {
  if (total <= 0 || maxTotal.value <= 0) return 0
  return Math.max(3, (total / maxTotal.value) * 100)
}

/** Weekday initial for the 7-day view ("M", "T", …). */
function dayInitial(date: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(
    new Date(`${date}T00:00:00`)
  )
}

/** Day-of-month, for sparse labels in the 30-day view. */
function dayOfMonth(date: string): number {
  return Number(date.slice(-2))
}

/** In the 30-day view only every 5th label is drawn, or the axis turns to mush. */
function showLabel(i: number): boolean {
  if (range.value === 7) return true
  return i % 5 === 0 || i === visible.value.length - 1
}
</script>

<template>
  <div>
    <!-- Range switch + range summary -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div
        class="inline-flex rounded-full border border-edge/10 bg-edge/5 p-0.5"
        role="group"
        aria-label="Chart range"
      >
        <button
          v-for="r in [7, 30] as const"
          :key="r"
          type="button"
          class="rounded-full px-3 py-1 font-mono text-xs font-medium transition-colors duration-200"
          :class="
            range === r
              ? 'bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
              : 'text-ink-soft hover:text-ink'
          "
          :aria-pressed="range === r"
          @click="range = r"
        >
          {{ r }}d
        </button>
      </div>
      <p class="font-mono text-xs text-ink-soft tnum">
        {{ formatMoney(rangeTotal) }} total ·
        {{ formatMoney(rangeAvg) }}/day
      </p>
    </div>

    <!-- Non-visual fallback: the same data as a plain table. -->
    <table class="sr-only">
      <caption>Spending per day, last {{ range }} days</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in visible" :key="p.date">
          <td>{{ formatDate(p.date) }}</td>
          <td>{{ formatMoney(p.total) }}</td>
        </tr>
      </tbody>
    </table>

    <!-- The bars (decorative for AT — the table above carries the data) -->
    <div
      class="mt-4 flex h-40 items-end gap-1 sm:gap-1.5"
      role="img"
      :aria-label="`Bar chart: spending per day over the last ${range} days — ${formatMoney(rangeTotal)} total, ${formatMoney(rangeAvg)} per day on average. Full data in the table above.`"
    >
      <div
        v-for="(p, i) in visible"
        :key="p.date"
        class="group relative flex h-full flex-1 flex-col justify-end"
      >
        <!-- Hover tooltip, same inverted surface as everywhere else. -->
        <span
          class="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-2 py-1 font-mono text-[0.65rem] text-zinc-50 opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 dark:bg-zinc-50 dark:text-zinc-900"
        >
          {{ formatDate(p.date) }} · {{ formatMoney(p.total) }}
        </span>

        <div
          class="w-full rounded-t-md transition-[height,background-color] duration-500"
          :class="
            p.total <= 0
              ? 'bg-edge/10'
              : i === visible.length - 1
                ? 'bg-accent'
                : 'bg-accent/55 group-hover:bg-accent/80'
          "
          :style="{ height: p.total <= 0 ? '2px' : heightPct(p.total) + '%' }"
        />
      </div>
    </div>

    <!-- X-axis labels -->
    <div class="mt-2 flex gap-1 sm:gap-1.5" aria-hidden="true">
      <span
        v-for="(p, i) in visible"
        :key="p.date"
        class="flex-1 text-center font-mono text-[0.6rem] leading-none text-ink-faint tnum"
      >
        {{ showLabel(i) ? (range === 7 ? dayInitial(p.date) : dayOfMonth(p.date)) : '' }}
      </span>
    </div>
  </div>
</template>
