<script setup lang="ts">
// Dashboard — the app's front page.
// A hero figure (this month's spend), three headline metric cards (balance,
// monthly change, savings rate), a 30-day trend line, spend-vs-budget bars,
// the by-category breakdown, a top-spending insight, and the most recent
// entries. All the numbers come from a single /api/stats request.
import {
  ArrowRight,
  Award,
  ArrowUpDown,
  Minus,
  PiggyBank,
  Plus,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-vue-next'
import type { StatsResponse } from '~/types/expense'

useHead({ title: 'Dashboard · Ledger' })

const { formatMoney, formatMonthLabel, formatDate, formatPercent } = useFormatters()

// Fetch on the client (server: false) so the page shell always renders even if
// the database isn't reachable yet, and so the hero number can count up on load.
const { data: stats, pending, error, refresh } = useFetch<StatsResponse>('/api/stats', {
  lazy: true,
  server: false
})

const currency = computed(() => stats.value?.currency ?? 'USD')
const monthLabel = formatMonthLabel()

// --- Hero count-up animation ------------------------------------------------
const animatedTotal = ref(0)
function countUp(target: number) {
  if (import.meta.server) {
    animatedTotal.value = target
    return
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    animatedTotal.value = target
    return
  }
  const duration = 850
  const startTime = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration)
    const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
    animatedTotal.value = target * eased
    if (t < 1) requestAnimationFrame(step)
    else animatedTotal.value = target
  }
  requestAnimationFrame(step)
}
watch(
  () => stats.value?.thisMonthTotal,
  (v) => countUp(v ?? 0),
  { immediate: true }
)

// --- Derived display values -------------------------------------------------
// Spending DOWN is good news, so the tones are inverted from the raw sign.
const deltaDirection = computed(() => {
  const p = stats.value?.momChangePct
  if (p == null || p === 0) return 'flat' as const
  return p > 0 ? ('up' as const) : ('down' as const)
})
const deltaTone = computed(() =>
  deltaDirection.value === 'up'
    ? ('negative' as const)
    : deltaDirection.value === 'down'
      ? ('positive' as const)
      : ('neutral' as const)
)
const heroDeltaIcon = computed(() =>
  deltaDirection.value === 'up' ? TrendingUp : deltaDirection.value === 'down' ? TrendingDown : Minus
)

// Month-over-month change in money terms, for the "Monthly change" card.
const monthDiff = computed(() => {
  if (!stats.value) return 0
  return stats.value.thisMonthTotal - stats.value.lastMonthTotal
})
const signedMoney = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v), currency.value)}`

const savingsTone = computed(() => {
  const r = stats.value?.savingsRate ?? 0
  return r >= 20 ? ('positive' as const) : r >= 0 ? ('neutral' as const) : ('negative' as const)
})

const donutSegments = computed(
  () =>
    stats.value?.breakdown.map((b) => ({
      label: b.name,
      color: b.color,
      value: b.total
    })) ?? []
)

const share = (total: number) => {
  const t = stats.value?.thisMonthTotal ?? 0
  return t > 0 ? (total / t) * 100 : 0
}

// --- Top-spending insight -----------------------------------------------------
// The dashboard's "so what": which category is eating the month, and how it
// sits against its budget.
const topInsight = computed(() => {
  const s = stats.value
  if (!s?.topCategory) return null
  const budgetRow = s.budgets.find((b) => b.categoryId === s.topCategory!.categoryId)
  const budget = budgetRow?.budget ?? 0
  return {
    ...s.topCategory,
    share: share(s.topCategory.total),
    budget,
    budgetUsedPct: budget > 0 ? (s.topCategory.total / budget) * 100 : 0
  }
})

// --- Add-expense modal ------------------------------------------------------
const showForm = ref(false)
</script>

<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────────────── -->
    <section class="animate-fade-up">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="eyebrow">Total spent · {{ monthLabel }}</p>

          <div v-if="pending" class="mt-2 h-16 w-64 animate-pulse rounded-lg bg-subtle" />
          <p
            v-else
            class="mt-1 font-display text-5xl font-semibold tracking-tight text-ink sm:text-6xl tnum"
          >
            {{ formatMoney(animatedTotal, currency) }}
          </p>

          <!-- Month-over-month change -->
          <p v-if="!pending && stats" class="mt-2 flex items-center gap-2 text-sm">
            <span
              v-if="stats.momChangePct !== null"
              class="inline-flex items-center gap-1 font-medium"
              :class="
                deltaTone === 'negative'
                  ? 'text-negative'
                  : deltaTone === 'positive'
                    ? 'text-positive'
                    : 'text-ink-soft'
              "
            >
              <component :is="heroDeltaIcon" class="h-4 w-4" aria-hidden="true" />
              {{ formatPercent(stats.momChangePct) }}
            </span>
            <span class="text-ink-soft">
              {{ stats.momChangePct !== null ? 'vs last month' : 'first tracked month' }}
              ({{ formatMoney(stats.lastMonthTotal, currency) }})
            </span>
          </p>
        </div>

        <button type="button" class="btn btn-primary" @click="showForm = true">
          <Plus class="h-4 w-4" aria-hidden="true" /> Add expense
        </button>
      </div>
      <div class="mt-6 double-rule" />
    </section>

    <!-- ── Error state ──────────────────────────────────────────────── -->
    <div v-if="error" class="card mt-8 p-8 text-center">
      <p class="font-display text-lg text-ink">Couldn't load your dashboard</p>
      <p class="mt-1 text-sm text-ink-soft">
        Make sure the database is running, then try again.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="refresh()">Retry</button>
    </div>

    <template v-else>
      <!-- ── Headline metrics ───────────────────────────────────────── -->
      <section class="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total balance"
          :value="pending ? '—' : formatMoney(stats?.balance ?? 0, currency)"
          :sub="pending ? '' : `of ${formatMoney(stats?.monthlyIncome ?? 0, currency)} income`"
          :icon="Wallet"
        />
        <StatCard
          label="Monthly change"
          :value="pending ? '—' : signedMoney(monthDiff)"
          sub="vs last month"
          :icon="ArrowUpDown"
          :delta="!pending && stats?.momChangePct !== null ? formatPercent(stats?.momChangePct ?? 0) : null"
          :delta-tone="deltaTone"
          :delta-direction="deltaDirection"
        />
        <StatCard
          label="Savings rate"
          :value="pending ? '—' : `${(stats?.savingsRate ?? 0).toFixed(1)}%`"
          sub="of monthly income kept"
          :icon="PiggyBank"
          :delta-tone="savingsTone"
        />
      </section>

      <!-- ── 30-day trend ───────────────────────────────────────────── -->
      <section class="card mt-4 p-5 sm:p-6">
        <p class="eyebrow">Spending · last 30 days</p>
        <div v-if="pending" class="mt-4 h-56 animate-pulse rounded-lg bg-subtle sm:h-64" />
        <ClientOnly v-else>
          <ChartsTrendLineChart
            v-if="stats"
            class="mt-4"
            :points="stats.dailyTrend"
            :currency="currency"
          />
        </ClientOnly>
      </section>

      <!-- ── Budget + breakdown ─────────────────────────────────────── -->
      <section class="mt-4 grid gap-4 lg:grid-cols-2">
        <!-- Spending vs budget -->
        <div class="card p-5 sm:p-6">
          <p class="eyebrow">Spending vs budget · {{ monthLabel }}</p>
          <div v-if="pending" class="mt-4 h-56 animate-pulse rounded-lg bg-subtle sm:h-64" />
          <ClientOnly v-else>
            <ChartsBudgetBarChart
              v-if="stats && stats.budgets.length"
              class="mt-2"
              :budgets="stats.budgets"
              :currency="currency"
            />
            <p v-else class="mt-6 text-sm text-ink-soft">No categories yet.</p>
          </ClientOnly>
        </div>

        <!-- Where it went -->
        <div class="card p-5 sm:p-6">
          <p class="eyebrow">Where it went · {{ monthLabel }}</p>

          <div
            v-if="!pending && stats && stats.breakdown.length"
            class="mt-4 grid items-center gap-6 sm:grid-cols-[auto_1fr]"
          >
            <CategoryDonut :segments="donutSegments" class="mx-auto">
              <span class="font-mono text-lg font-semibold text-ink tnum">
                {{ formatMoney(stats.thisMonthTotal, currency) }}
              </span>
              <span class="eyebrow mt-0.5">this month</span>
            </CategoryDonut>

            <!-- Category ledger bars -->
            <ul class="space-y-3">
              <li v-for="b in stats.breakdown" :key="b.categoryId">
                <div class="flex items-center justify-between gap-2 text-sm">
                  <span class="flex items-center gap-2 font-medium text-ink">
                    <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: b.color }" />
                    {{ b.name }}
                  </span>
                  <span class="font-mono text-ink-soft tnum">
                    {{ formatMoney(b.total, currency) }} · {{ share(b.total).toFixed(0) }}%
                  </span>
                </div>
                <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :style="{ width: share(b.total) + '%', backgroundColor: b.color }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div v-else-if="pending" class="mt-4 h-44 animate-pulse rounded-lg bg-subtle" />

          <p v-else class="mt-6 text-sm text-ink-soft">
            No spending recorded this month yet. Add an expense to see the breakdown.
          </p>
        </div>
      </section>

      <!-- ── Insight + recent ───────────────────────────────────────── -->
      <section class="mt-4 grid gap-4 lg:grid-cols-2">
        <!-- Top spending insight -->
        <div class="card p-5 sm:p-6">
          <div class="flex items-center gap-2">
            <Award class="h-4 w-4 text-ink-soft" aria-hidden="true" />
            <p class="eyebrow">Top spending · {{ monthLabel }}</p>
          </div>

          <div v-if="pending" class="mt-4 h-24 animate-pulse rounded-lg bg-subtle" />

          <div v-else-if="topInsight" class="mt-4">
            <div class="flex items-baseline justify-between gap-3">
              <p class="text-lg font-semibold text-ink">{{ topInsight.name }}</p>
              <p class="font-mono text-lg font-semibold text-ink tnum">
                {{ formatMoney(topInsight.total, currency) }}
              </p>
            </div>
            <p class="mt-1 text-sm text-ink-soft">
              {{ topInsight.share.toFixed(0) }}% of this month's spending across
              {{ topInsight.count }} {{ topInsight.count === 1 ? 'entry' : 'entries' }}.
            </p>

            <template v-if="topInsight.budget > 0">
              <div class="mt-4 flex items-center justify-between text-sm">
                <span class="text-ink-soft">Budget used</span>
                <span
                  class="font-mono font-medium tnum"
                  :class="topInsight.budgetUsedPct > 100 ? 'text-negative' : 'text-positive'"
                >
                  {{ topInsight.budgetUsedPct.toFixed(0) }}% of
                  {{ formatMoney(topInsight.budget, currency) }}
                </span>
              </div>
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="topInsight.budgetUsedPct > 100 ? 'bg-negative' : 'bg-positive'"
                  :style="{ width: Math.min(topInsight.budgetUsedPct, 100) + '%' }"
                />
              </div>
            </template>
          </div>

          <p v-else class="mt-6 text-sm text-ink-soft">
            Nothing logged yet this month — the insight appears with your first entry.
          </p>
        </div>

        <!-- Recent entries -->
        <div class="card p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <p class="eyebrow">Recent entries</p>
            <NuxtLink
              to="/expenses"
              class="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
            >
              View all <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
            </NuxtLink>
          </div>

          <div v-if="pending" class="mt-4 space-y-3">
            <div v-for="n in 5" :key="n" class="h-10 animate-pulse rounded-lg bg-subtle" />
          </div>

          <ul v-else-if="stats && stats.recent.length" class="mt-2 divide-y divide-edge">
            <li v-for="e in stats.recent" :key="e.id" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate font-medium text-ink">{{ e.description }}</p>
                <div class="mt-1 flex items-center gap-2">
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
              <span class="whitespace-nowrap font-mono font-semibold text-ink tnum">
                {{ formatMoney(e.amount, currency) }}
              </span>
            </li>
          </ul>

          <p v-else class="mt-6 text-sm text-ink-soft">No entries yet.</p>
        </div>
      </section>
    </template>

    <!-- Add-expense modal; refresh the dashboard after a successful save. -->
    <ExpenseForm
      :open="showForm"
      :editing="null"
      @close="showForm = false"
      @saved="refresh()"
    />
  </div>
</template>
