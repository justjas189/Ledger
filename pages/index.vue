<script setup lang="ts">
// Dashboard — the app's front page.
// Shows this month's total (the hero figure), a few headline stats, a
// by-category breakdown, and the most recent entries. All the numbers come
// from a single /api/stats request.
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
const deltaTone = computed(() => {
  const p = stats.value?.momChangePct
  if (p == null || p === 0) return 'flat'
  return p > 0 ? 'up' : 'down'
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

          <div v-if="pending" class="mt-2 h-16 w-64 animate-pulse rounded-lg bg-ledger" />
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
              :class="deltaTone === 'up' ? 'text-clay' : deltaTone === 'down' ? 'text-pine' : 'text-ink-soft'"
            >
              <span aria-hidden="true">{{ deltaTone === 'up' ? '▲' : deltaTone === 'down' ? '▼' : '■' }}</span>
              {{ formatPercent(stats.momChangePct) }}
            </span>
            <span class="text-ink-soft">
              {{ stats.momChangePct !== null ? 'vs last month' : 'first tracked month' }}
              ({{ formatMoney(stats.lastMonthTotal, currency) }})
            </span>
          </p>
        </div>

        <button type="button" class="btn btn-primary" @click="showForm = true">
          <span aria-hidden="true">＋</span> Add expense
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
      <!-- ── Headline stats ─────────────────────────────────────────── -->
      <section class="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Entries this month"
          :value="pending ? '—' : String(stats?.thisMonthCount ?? 0)"
          sub="expenses logged"
          accent="#1E5A48"
        />
        <StatCard
          label="Average entry"
          :value="pending ? '—' : formatMoney(stats?.averageExpense ?? 0, currency)"
          sub="this month"
          accent="#B7892F"
        />
        <StatCard
          label="All-time total"
          :value="pending ? '—' : formatMoney(stats?.allTimeTotal ?? 0, currency)"
          sub="every entry, ever"
          accent="#B23A2E"
        />
      </section>

      <!-- ── Breakdown + recent ─────────────────────────────────────── -->
      <section class="mt-4 grid gap-4 lg:grid-cols-2">
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
                    {{ b.icon ? b.icon + ' ' : '' }}{{ b.name }}
                  </span>
                  <span class="font-mono text-ink-soft tnum">
                    {{ formatMoney(b.total, currency) }} · {{ share(b.total).toFixed(0) }}%
                  </span>
                </div>
                <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ledger">
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :style="{ width: share(b.total) + '%', backgroundColor: b.color }"
                  />
                </div>
              </li>
            </ul>
          </div>

          <div v-else-if="pending" class="mt-4 h-44 animate-pulse rounded-lg bg-ledger" />

          <p v-else class="mt-6 text-sm text-ink-soft">
            No spending recorded this month yet. Add an expense to see the breakdown.
          </p>
        </div>

        <!-- Recent entries -->
        <div class="card p-5 sm:p-6">
          <div class="flex items-center justify-between">
            <p class="eyebrow">Recent entries</p>
            <NuxtLink to="/expenses" class="text-sm font-medium text-pine hover:underline">
              View all →
            </NuxtLink>
          </div>

          <div v-if="pending" class="mt-4 space-y-3">
            <div v-for="n in 5" :key="n" class="h-10 animate-pulse rounded-lg bg-ledger" />
          </div>

          <ul v-else-if="stats && stats.recent.length" class="mt-2 divide-y divide-rule">
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
