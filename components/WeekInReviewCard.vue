<script setup lang="ts">
// Week-in-review card (ROADMAP §4, Retention).
// Renders the Monday reflection: last week's total with a delta pill vs the
// week before, the top category, and the week's one most unusual charge.
// All data + the per-week dismissal live in useWeekInReview; this component
// only lays it out. Renders nothing until the 90-day pool has resolved, and
// nothing at all once dismissed for the week.
import { Minus, TrendingDown, TrendingUp, X } from 'lucide-vue-next'

const { review, visible, dismiss } = useWeekInReview()
const { formatMoney, formatPercent, formatDate } = useFormatters()

// Spending DOWN week-over-week is the good outcome — tones invert the sign,
// matching the dashboard's month-over-month pill.
const deltaTone = computed(() => {
  const p = review.value.deltaPct
  if (p == null || p === 0) return 'flat' as const
  return p > 0 ? ('worse' as const) : ('better' as const)
})
const deltaIcon = computed(() =>
  deltaTone.value === 'worse' ? TrendingUp : deltaTone.value === 'better' ? TrendingDown : Minus
)
</script>

<template>
  <section
    v-if="visible"
    class="glass-card animate-rise relative p-6"
    aria-label="Week in review"
  >
    <button
      type="button"
      class="absolute right-4 top-4 rounded-full p-1.5 text-ink-faint transition-colors duration-200 hover:bg-edge/10 hover:text-ink"
      aria-label="Dismiss week in review"
      @click="dismiss()"
    >
      <X class="h-4 w-4" aria-hidden="true" />
    </button>

    <p class="eyebrow">Week in review · {{ review.weekLabel }}</p>

    <div class="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2">
      <p class="font-display text-3xl font-bold tracking-tight text-ink tnum">
        {{ formatMoney(review.total) }}
      </p>
      <span
        v-if="review.deltaPct !== null"
        class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-medium tnum"
        :class="
          deltaTone === 'worse'
            ? 'border-negative/30 bg-negative/10 text-negative'
            : deltaTone === 'better'
              ? 'border-positive/30 bg-positive/10 text-positive'
              : 'border-edge/10 bg-edge/5 text-ink-soft'
        "
      >
        <component :is="deltaIcon" class="h-3.5 w-3.5" aria-hidden="true" />
        {{ formatPercent(review.deltaPct) }}
      </span>
      <span class="text-sm text-ink-soft">
        {{
          review.deltaPct !== null
            ? `vs the week before (${formatMoney(review.priorTotal)})`
            : 'first tracked week'
        }}
      </span>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      <div v-if="review.topCategory" class="flex items-center gap-2">
        <span class="text-ink-soft">Top category</span>
        <CategoryPill
          v-if="review.topCategory.category"
          :name="review.topCategory.category.name"
          :color="review.topCategory.category.color"
          :icon="review.topCategory.category.icon"
          size="sm"
        />
        <span class="font-mono font-semibold text-ink tnum">
          {{ formatMoney(review.topCategory.total) }}
        </span>
      </div>

      <div v-if="review.anomaly" class="flex min-w-0 items-center gap-2">
        <span
          class="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[0.65rem] font-medium text-amber-600 dark:text-amber-400"
        >
          <TrendingUp class="h-3 w-3" aria-hidden="true" />
          Unusual
        </span>
        <span class="truncate text-ink-soft">
          {{ review.anomaly.description }} —
          <span class="font-mono font-medium text-ink tnum">{{ formatMoney(review.anomaly.amount) }}</span>
          on {{ formatDate(review.anomaly.date) }}
        </span>
      </div>
    </div>
  </section>
</template>
