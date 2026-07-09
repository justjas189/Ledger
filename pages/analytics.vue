<script setup lang="ts">
// Analytics — the deep-dive page. The dashboard stays at-a-glance; this page
// lays out the full spending-activity toolkit SIMULTANEOUSLY (no tabs):
// the interactive expense calendar, the daily bar chart, the month-vs-month
// compare line, plus the top-spending breakdown card. All numbers come from
// the same single /api/stats request the dashboard uses — the locked payload.
import { Award, BarChart3, CalendarDays, Sparkles, TrendingUp } from 'lucide-vue-next'
import type { StatsResponse } from '~/types/expense'
import MonthReportCard from '~/components/MonthReportCard.vue'

useHead({ title: 'Analytics · Vaulted' })

const { formatMoney, formatMonthLabel } = useFormatters()
// The shareable month summary — the modal itself is hosted in the layout.
const { open: openReport } = useReportCard()

// Fetch on the client (server: false) so the page shell always renders even
// if the database isn't reachable yet — same pattern as the dashboard.
// getCachedData + the shared 'stats' key reuse the dashboard's payload, so
// hopping between the two pages never refetches within a session. The tz
// param must stay identical to the dashboard's fetch for that reason.
const { data: stats, pending, error, refresh } = useFetch<StatsResponse>('/api/stats', {
  key: 'stats',
  query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  lazy: true,
  server: false,
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
})

// Seasonal month-end forecast (weekday means + recurring monthly spikes —
// served by GET /api/stats/forecast since unlock batch #1, with the original
// client computation as offline fallback; see useForecast). Rendered as the
// dashed continuation on the month-compare chart below.
const { ready: forecastReady, forecastDays, projectedTotal } = useForecast()

const monthLabel = formatMonthLabel()

// --- Top-spending insight -----------------------------------------------------
// Which category is eating the month, and how it sits against its budget.
// (Moved here from the dashboard as part of the de-clutter split.)
const topInsight = computed(() => {
  const s = stats.value
  if (!s?.topCategory) return null
  const monthTotal = s.thisMonthTotal
  const budgetRow = s.budgets.find((b) => b.categoryId === s.topCategory!.categoryId)
  const budget = budgetRow?.budget ?? 0
  return {
    ...s.topCategory,
    share: monthTotal > 0 ? (s.topCategory.total / monthTotal) * 100 : 0,
    budget,
    budgetUsedPct: budget > 0 ? (s.topCategory.total / budget) * 100 : 0
  }
})
</script>

<template>
  <div>
    <!-- ── Page header ──────────────────────────────────────────────── -->
    <div class="animate-rise">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="font-display text-3xl font-bold tracking-tight text-ink">Analytics</h1>
          <p class="mt-1 text-sm text-ink-soft">
            Every spending view at once — calendar, daily rhythm, and month-over-month pace.
          </p>
        </div>
        <button type="button" class="btn btn-ghost" @click="openReport()">
          <Sparkles class="h-4 w-4 text-positive" aria-hidden="true" />
          Report card
        </button>
      </div>
      <div class="hairline mt-6" />
    </div>

    <!-- ── Error state ──────────────────────────────────────────────── -->
    <div v-if="error" class="glass-card mt-8 p-8 text-center">
      <p class="font-display text-lg font-semibold text-ink">Couldn't load your analytics</p>
      <p class="mt-1 text-sm text-ink-soft">
        Make sure the database is running, then try again.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="refresh()">Retry</button>
    </div>

    <template v-else>
      <!-- ── TOP ROW: Calendar + Month Compare ────────────────────── -->
      <section class="mt-8 grid gap-4 lg:grid-cols-5">
        
        <!-- Interactive month calendar (Left, 2 columns) -->
        <div class="glass-card animate-rise p-6 lg:col-span-2" style="animation-delay: 0.08s">
          <div class="flex items-center gap-2">
            <CalendarDays class="h-4 w-4 text-ink-faint" aria-hidden="true" />
            <p class="eyebrow">Calendar · {{ monthLabel }}</p>
          </div>
          <WidgetBoundary label="The calendar widget">
            <SkeletonChart v-if="pending" variant="calendar" class="mt-5" />
            <ClientOnly v-else>
              <LazyChartsExpenseCalendar hydrate-on-visible class="mt-4" />
            </ClientOnly>
          </WidgetBoundary>
        </div>

        <!-- This month's trajectory vs last month's average pace (Right, 3 columns) -->
        <div class="glass-card animate-rise p-6 lg:col-span-3" style="animation-delay: 0.16s">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <TrendingUp class="h-4 w-4 text-ink-faint" aria-hidden="true" />
              <p class="eyebrow">Month vs month</p>
            </div>
            <p v-if="forecastReady" class="font-mono text-xs text-ink-soft tnum">
              Forecast: <span class="font-semibold text-ink">{{ formatMoney(projectedTotal) }}</span>
              by month end
            </p>
          </div>
          <WidgetBoundary label="The month-compare widget">
            <SkeletonChart v-if="pending" variant="line" class="mt-5" />
            <ClientOnly v-else>
              <LazyChartsTrendCompareChart
                v-if="stats"
                hydrate-on-visible
                class="mt-4"
                :points="stats.dailyTrend"
                :last-month-total="stats.lastMonthTotal"
                :forecast="forecastReady ? forecastDays : undefined"
              />
            </ClientOnly>
          </WidgetBoundary>
        </div>
      </section>

      <!-- ── BOTTOM ROW: Daily Bars + Top Spending ───────────────────────────── -->
      <section class="mt-4 grid gap-4 lg:grid-cols-5">
        
        <!-- Daily totals bar chart (Left, 3 columns) -->
        <div class="glass-card animate-rise p-6 lg:col-span-3" style="animation-delay: 0.24s">
          <div class="flex items-center gap-2">
            <BarChart3 class="h-4 w-4 text-ink-faint" aria-hidden="true" />
            <p class="eyebrow">Daily spending</p>
          </div>
          <WidgetBoundary label="The daily spending widget">
            <SkeletonChart v-if="pending" variant="bars" class="mt-5" />
            <ClientOnly v-else>
              <LazyChartsDailyBarChart
                v-if="stats"
                hydrate-on-visible
                class="mt-4"
                :points="stats.dailyTrend"
              />
            </ClientOnly>
          </WidgetBoundary>
        </div>

        <!-- Top spending insight (Right, 2 columns) -->
        <div class="glass-card animate-rise p-6 lg:col-span-2" style="animation-delay: 0.32s">
          <div class="flex items-center gap-2">
            <Award class="h-4 w-4 text-ink-faint" aria-hidden="true" />
            <p class="eyebrow">Top spending · {{ monthLabel }}</p>
          </div>

          <WidgetBoundary label="The top spending widget">
            <div v-if="pending" class="mt-4 space-y-3" aria-hidden="true">
              <div class="flex items-baseline justify-between gap-3">
                <div class="skeleton h-5 w-28" />
                <div class="skeleton h-5 w-20" :style="{ '--stagger': 1 }" />
              </div>
              <div class="skeleton h-4 w-full" :style="{ '--stagger': 2 }" />
              <div class="skeleton mt-2 h-1.5 w-full rounded-full" :style="{ '--stagger': 3 }" />
            </div>

            <div v-else-if="topInsight" class="mt-4">
              <div class="flex items-baseline justify-between gap-3">
                <p class="text-lg font-semibold text-ink">{{ topInsight.name }}</p>
                <p class="font-mono text-lg font-semibold text-ink tnum">
                  {{ formatMoney(topInsight.total) }}
                </p>
              </div>
              <p class="mt-1 text-sm text-ink-soft">
                {{ topInsight.share.toFixed(0) }}% of this month's spending across
                {{ topInsight.count }} {{ topInsight.count === 1 ? 'entry' : 'entries' }}.
              </p>

              <template v-if="topInsight.budget > 0">
                <div class="mt-5 flex items-center justify-between text-sm">
                  <span class="text-ink-soft">Budget used</span>
                  <span
                    class="font-mono font-medium tnum"
                    :class="topInsight.budgetUsedPct > 100 ? 'text-negative' : 'text-positive'"
                  >
                    {{ topInsight.budgetUsedPct.toFixed(0) }}% of
                    {{ formatMoney(topInsight.budget) }}
                  </span>
                </div>
                <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-edge/10">
                  <div
                    class="h-full rounded-full transition-all duration-700"
                    :class="topInsight.budgetUsedPct > 100 ? 'bg-negative' : 'bg-positive'"
                    :style="{ width: Math.min(topInsight.budgetUsedPct, 100) + '%' }"
                  />
                </div>
              </template>
            </div>

            <p v-else class="mt-6 text-sm text-ink-faint">
              Nothing logged yet this month — the insight appears with your first entry.
            </p>
          </WidgetBoundary>
        </div>

      </section>
    </template>
  </div>
</template>
