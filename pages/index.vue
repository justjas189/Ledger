<script setup lang="ts">
// Dashboard — the app's front page, kept deliberately at-a-glance.
// A hero figure (this month's spend) with the USD/PHP display-currency
// toggle, three metric tiles (balance, monthly change, savings rate),
// per-category budget rings, packed category bubbles, and the most recent
// entries. The deep-dive views (calendar / daily bars / month compare and
// the top-spending breakdown) live on /analytics. All the numbers come from
// a single /api/stats request — the same locked payload Ledger used.
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  Coins,
  Gauge,
  Minus,
  Pencil,
  PiggyBank,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-vue-next'
import type { CurrencyCode } from '~/composables/useCurrency'
import type { StatsResponse } from '~/types/expense'

useHead({ title: 'Dashboard · Vaulted' })

const { formatMoney, formatMoneyLiteral, formatMonthLabel, formatDate, formatPercent } =
  useFormatters()
const { active: displayCurrency, set: setCurrency } = useCurrency()
const { open: openQuickAdd } = useQuickAdd()
const { pendingAdds, hiddenIds } = useOptimisticExpenses()

// v-model bridge for the currency <select>: writing through set() persists
// the choice to localStorage as well as flipping the shared state.
const currencyModel = computed({
  get: () => displayCurrency.value,
  set: (code: CurrencyCode) => setCurrency(code)
})

// Locale-aware preview next to the picker: shows how the active currency
// groups/punctuates its own thousands (e.g. "Rp1.000" vs "$1,000.00") — a
// quick visual cue for what's about to change before the whole page re-renders.
const thousandsPreview = computed(() => formatMoneyLiteral(1000))

// Fetch on the client (server: false) so the page shell always renders even if
// the database isn't reachable yet, and so the hero number can count up on load.
// getCachedData reuses the payload already fetched this session (shared with
// /analytics via the explicit key), so back-navigation paints instantly while
// the Nitro swr rule (nuxt.config.ts) keeps the response itself fresh.
// The browser's zone rides along so month/day buckets follow the user's
// calendar, not the server's (must stay identical to the /analytics fetch —
// they share the 'stats' cache key).
const { data: rawStats, pending, error, refresh } = useFetch<StatsResponse>('/api/stats', {
  key: 'stats',
  query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
  lazy: true,
  server: false,
  getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
})

// The monthly budget now lives in the DB (Profile.monthlyBudget) and is baked
// into the /api/stats payload server-side, so the dashboard reads the payload
// directly — no more client-side localStorage overlay.
const stats = computed(() => rawStats.value)

// Onboarding rides along in the /api/stats payload (stats.onboarded) — one
// resilient fetch, no separate settings request that can fail on its own. A
// brand-new user (no budget set) gets the unskippable welcome modal. Null stats
// (still loading or errored) → no modal, so onboarded users never see a flash.
const needsOnboarding = computed(() => !!stats.value && !stats.value.onboarded)

// A saved budget (onboarding or edit) shifts income-derived figures — refresh
// the stats payload, which also carries the updated onboarded flag.
async function onBudgetSaved() {
  await refresh()
}

// The "Monthly budget" edit dialog, opened from the balance tile's pencil —
// state is shared (useBudgetModal) so the header account menu can open it too.
const { isOpen: budgetModalOpen } = useBudgetModal()

// The "Add category" / "Manage categories" dialogs, opened from the Budgets
// widget header.
const addCategoryModalOpen = ref(false)
const manageCategoriesOpen = ref(false)

const monthLabel = formatMonthLabel()

// Daily nudge (ROADMAP §4): once stats + the 90-day pool are in, surface at
// most ONE guardian message per day — the single most severe signal.
useNudges(stats)

// --- Count-up tickers ---------------------------------------------------
// One shared composable (useCountUp) drives the hero figure and the three
// metric tiles; it snaps instantly under prefers-reduced-motion.
const animatedTotal = useCountUp(() => stats.value?.thisMonthTotal)
const animatedBalance = useCountUp(() => stats.value?.balance)
const animatedSavingsRate = useCountUp(() => stats.value?.savingsRate)

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

// Month-over-month change in money terms, for the "Monthly change" tile.
const monthDiff = computed(() => {
  if (!stats.value) return 0
  return stats.value.thisMonthTotal - stats.value.lastMonthTotal
})
const animatedMonthDiff = useCountUp(() => monthDiff.value)
const signedMoney = (v: number) =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatMoney(Math.abs(v))}`

const savingsTone = computed(() => {
  const r = stats.value?.savingsRate ?? 0
  return r >= 20 ? ('positive' as const) : r >= 0 ? ('neutral' as const) : ('negative' as const)
})

// Recent entries as displayed: optimistic adds appear on top the moment the
// quick-add closes, and rows inside their delete-undo window are hidden.
const recentEntries = computed(() => {
  const rows = (stats.value?.recent ?? []).filter((e) => !hiddenIds.value.includes(e.id))
  return [...pendingAdds.value, ...rows].slice(0, 6)
})

// A truly fresh account (ROADMAP §3): onboarded (budget set) but not a single
// expense ever — allTimeTotal covers all history, so this can't false-positive
// on a quiet month. The optimistic-adds check flips the hero to its normal
// state the instant the first quick-add closes, before the stats refetch.
const isFresh = computed(
  () =>
    !!stats.value &&
    stats.value.onboarded &&
    stats.value.allTimeTotal === 0 &&
    pendingAdds.value.length === 0
)
</script>

<template>
  <div>
    <!-- ── Hero ─────────────────────────────────────────────────────── -->
    <section class="animate-rise text-center">
      <div class="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5">
        <p class="eyebrow">Total spent · {{ monthLabel }}</p>
        <!-- Display-currency dropdown: every figure in the app is converted
             from base USD at the selected static rate, then re-rendered.
             Option text stays short (flag + symbol + code, no spelled-out
             label) so the pill can't grow wider than the row on mobile —
             the full name is still reachable via the label's title tooltip
             and the other pickers (welcome modal, account menu, palette). -->
        <label
          class="glass relative inline-flex cursor-pointer items-center gap-1.5 rounded-full py-1 pl-2.5 pr-2 font-mono text-xs font-medium text-ink-soft transition-colors duration-200 focus-within:text-ink hover:text-ink"
          :title="`Display currency: ${displayCurrency} — amounts are converted`"
        >
          <Coins class="h-3.5 w-3.5 text-positive" aria-hidden="true" />
          <select
            id="currency"
            name="currency"
            v-model="currencyModel"
            class="cursor-pointer appearance-none bg-transparent pr-4 font-mono text-xs font-medium text-inherit outline-none"
            aria-label="Display currency"
          >
            <option v-for="o in CURRENCY_OPTIONS" :key="o.code" :value="o.code">
              {{ o.flag }} {{ o.symbol }} {{ o.code }}
            </option>
          </select>
          <ChevronDown
            class="pointer-events-none absolute right-2 h-3 w-3"
            aria-hidden="true"
          />
        </label>

        <!-- Thousands preview: reflects the active currency's own grouping
             style (period vs comma, symbol placement) at a glance. Wraps onto
             its own centered line on narrow screens via the parent's flex-wrap. -->
        <span class="font-mono text-[0.65rem] text-ink-faint" aria-hidden="true">
          e.g. {{ thousandsPreview }}
        </span>
      </div>

      <div v-if="pending" class="skeleton mx-auto mt-3 h-16 w-72 rounded-2xl" />
      <p
        v-else
        class="mt-4 font-display text-6xl font-bold tracking-tight text-ink tnum sm:mt-2 sm:text-7xl"
      >
        {{ formatMoney(animatedTotal) }}
      </p>

      <!-- Fresh account (post-onboarding, zero entries ever): swap the empty
           delta/pace lines for a guided prompt. The whole card is one big
           button so mouse/touch users aren't left out of the shortcut.
           Below sm there's no keyboard, so the "N" keycap and its copy give
           way to a hint pointing at the dock's floating + button instead —
           this card still works as a tap target either way. -->
      <div v-if="!pending && stats && isFresh" class="mt-6 flex justify-center">
        <button
          type="button"
          class="group flex items-center gap-4 rounded-2xl border border-dashed border-edge/20 px-6 py-4 text-left transition-colors duration-200 hover:border-positive/50"
          @click="openQuickAdd()"
        >
          <!-- Desktop: pulsing "N" keycap — the actual keyboard shortcut. -->
          <span
            class="key-hint relative hidden h-12 w-12 shrink-0 place-items-center rounded-xl border border-black/10 bg-white font-mono text-xl font-bold text-ink shadow-sm dark:border-white/15 dark:bg-zinc-900 sm:grid"
            aria-hidden="true"
          >
            N
          </span>
          <!-- Mobile: no keyboard exists, so mirror the dock's own +
               button (same shape/color) to point at it instead. -->
          <span
            class="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-emerald-600 text-white shadow-sm sm:hidden"
            aria-hidden="true"
          >
            <Plus class="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span class="hidden font-medium text-ink sm:block">
              Press <span class="font-mono font-bold">N</span> to log your first expense
            </span>
            <span class="block font-medium text-ink sm:hidden">
              Tap <span class="font-bold">+</span> below to log your first expense
            </span>
            <span class="block text-sm text-ink-faint">
              <span class="hidden sm:inline">or click here — it takes about ten seconds</span>
              <span class="sm:hidden">or tap here — it takes about ten seconds</span>
            </span>
          </span>
        </button>
      </div>

      <!-- Month-over-month change -->
      <p v-else-if="!pending && stats" class="mt-4 flex items-center justify-center gap-2 text-sm">
        <span
          v-if="stats.momChangePct !== null"
          class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-xs font-medium tnum"
          :class="
            deltaTone === 'negative'
              ? 'border-negative/30 bg-negative/10 text-negative'
              : deltaTone === 'positive'
                ? 'border-positive/30 bg-positive/10 text-positive'
                : 'border-edge/10 bg-edge/5 text-ink-soft'
          "
        >
          <component :is="heroDeltaIcon" class="h-3.5 w-3.5" aria-hidden="true" />
          {{ formatPercent(stats.momChangePct) }}
        </span>
        <span class="text-ink-soft">
          {{ stats.momChangePct !== null ? 'vs last month' : 'first tracked month' }}
          ({{ formatMoney(stats.lastMonthTotal) }})
        </span>
      </p>

      <!-- Spending pace: straight-line projection of the month's total.
           Rose when the pace would blow past income or the total budget —
           an early warning while behaviour can still change. -->
      <p
        v-if="!pending && stats && !isFresh"
        class="mt-2 flex items-center justify-center gap-1.5 text-sm text-ink-soft"
      >
        <Gauge class="h-4 w-4" aria-hidden="true" />
        On pace for
        <span
          class="font-mono font-semibold tnum"
          :class="stats.paceOverLimit ? 'text-negative' : 'text-ink'"
        >
          {{ formatMoney(stats.projectedMonthTotal) }}
        </span>
        this month
        <span v-if="stats.paceOverLimit" class="font-medium text-negative">
          · over {{ stats.projectedMonthTotal > stats.monthlyIncome - stats.thisMonthSaved ? 'income' : 'budget' }}
        </span>
      </p>
    </section>

    <!-- ── Error state ──────────────────────────────────────────────── -->
    <div v-if="error" class="glass-card mt-10 p-8 text-center">
      <p class="font-display text-lg font-semibold text-ink">Couldn't load your dashboard</p>
      <p class="mt-1 text-sm text-ink-soft">
        Make sure the database is running, then try again.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="refresh()">Retry</button>
    </div>

    <template v-else>
      <!-- ── Week in review ─────────────────────────────────────────── -->
      <!-- The Monday reflection ritual: appears once the 90-day pool has
           resolved, stays for the week, dismissible per week. Renders
           nothing (no gap) when hidden. -->
      <WeekInReviewCard class="mt-10" />

      <!-- ── Headline metrics ───────────────────────────────────────── -->
      <section class="mt-10 grid gap-4 sm:grid-cols-3">
        <div class="animate-rise" style="animation-delay: 0.08s">
          <SkeletonStatCard v-if="pending" :stagger="0" />
          <StatCard
            v-else
            label="Safe to Spend"
            :value="formatMoney(animatedBalance)"
            :icon="Wallet"
          >
            <!-- Supporting line doubles as the budget-edit affordance. -->
            <template #sub>
              <button
                type="button"
                class="group/edit -ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-ink-faint transition-colors duration-200 hover:bg-black/5 hover:text-ink dark:hover:bg-white/5"
                title="Edit monthly budget"
                aria-label="Edit monthly budget"
                @click="budgetModalOpen = true"
              >
                <span>
                  of
                  <!-- Dashed underline: the universal "this value is editable" cue. -->
                  <span
                    class="underline decoration-ink-faint/50 decoration-dashed underline-offset-4 transition-colors duration-200 group-hover/edit:decoration-ink"
                  >{{ formatMoney(stats?.monthlyIncome ?? 0) }}</span>
                  income
                </span>
                <Pencil
                  class="h-4 w-4 text-positive/70 transition-colors duration-200 group-hover/edit:text-positive"
                  aria-hidden="true"
                />
              </button>
            </template>
          </StatCard>
        </div>
        <div class="animate-rise" style="animation-delay: 0.16s">
          <SkeletonStatCard v-if="pending" :stagger="1" />
          <StatCard
            v-else
            label="Monthly change"
            :value="signedMoney(animatedMonthDiff)"
            sub="vs last month"
            :icon="ArrowUpDown"
            :delta="stats?.momChangePct !== null ? formatPercent(stats?.momChangePct ?? 0) : null"
            :delta-tone="deltaTone"
            :delta-direction="deltaDirection"
          />
        </div>
        <div class="animate-rise" style="animation-delay: 0.24s">
          <SkeletonStatCard v-if="pending" :stagger="2" />
          <StatCard
            v-else
            label="Savings rate"
            :value="`${animatedSavingsRate.toFixed(1)}%`"
            sub="of income saved to goals"
            :icon="PiggyBank"
            :delta-tone="savingsTone"
          />
        </div>
      </section>

      <!-- ── Budget rings ───────────────────────────────────────────── -->
      <section class="glass-card animate-rise mt-4 p-6" style="animation-delay: 0.32s">
        <div class="flex items-center justify-between gap-3">
          <p class="eyebrow">Budgets · {{ monthLabel }}</p>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold text-ink-faint
                transition-colors hover:text-ink"
              @click="manageCategoriesOpen = true"
            >
              <Settings class="h-3.5 w-3.5" aria-hidden="true" />
              Manage
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 text-xs font-semibold text-accent-strong
                transition-colors hover:text-ink"
              @click="addCategoryModalOpen = true"
            >
              <Plus class="h-3.5 w-3.5" aria-hidden="true" />
              Add category
            </button>
          </div>
        </div>
        <WidgetBoundary label="The budget rings widget">
          <SkeletonChart v-if="pending" variant="rings" class="mt-5" />
          <ClientOnly v-else>
            <!-- Lazy + hydrate-on-visible (ROADMAP §1): chart code loads in
                 its own chunk and hydrates when scrolled into view. -->
            <LazyChartsBudgetRings
              v-if="stats && stats.budgets.length"
              hydrate-on-visible
              class="mt-6"
              :budgets="stats.budgets"
            />
            <!-- Ghost rings preview what the widget becomes (ROADMAP §3). -->
            <EmptyRings v-else class="mt-4" @action="openQuickAdd()" />
          </ClientOnly>
        </WidgetBoundary>
      </section>

      <!-- ── Savings goals ──────────────────────────────────────────── -->
      <!-- Client-only: goals are fetched from /api/goals on the client (with
           the display currency applied at render), so SSR has nothing to paint
           and would only mismatch. -->
      <ClientOnly>
        <SavingsGoals class="animate-rise mt-4" style="animation-delay: 0.36s" />
      </ClientOnly>

      <!-- ── Breakdown + recent ─────────────────────────────────────── -->
      <section class="mt-4 grid gap-4 lg:grid-cols-2">
        <!-- Where it went: packed bubbles -->
        <div class="glass-card animate-rise p-6" style="animation-delay: 0.4s">
          <p class="eyebrow">Where it went · {{ monthLabel }}</p>
          <WidgetBoundary label="The category breakdown widget">
            <SkeletonChart v-if="pending" variant="bubbles" class="mt-5" />
            <ClientOnly v-else>
              <LazyCategoryBubbles
                v-if="stats && stats.breakdown.length"
                hydrate-on-visible
                class="mt-4"
                :segments="stats.breakdown"
              />
              <!-- Ghost bubble pack previews the breakdown (ROADMAP §3). -->
              <EmptyBubbles v-else class="mt-4" @action="openQuickAdd()" />
            </ClientOnly>
          </WidgetBoundary>
        </div>

        <!-- Recent entries -->
        <div class="glass-card animate-rise p-6" style="animation-delay: 0.48s">
          <div class="flex items-center justify-between">
            <p class="eyebrow">Recent entries</p>
            <NuxtLink
              to="/expenses"
              class="group inline-flex items-center gap-1 text-sm font-medium text-positive transition-colors hover:text-ink"
            >
              View all
              <ArrowRight
                class="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </NuxtLink>
          </div>

          <WidgetBoundary label="The recent entries widget">
            <SkeletonChart v-if="pending" variant="list" class="mt-2" />

            <TransitionGroup
              v-else-if="recentEntries.length"
              tag="ul"
              name="recent"
              appear
              class="mt-2 divide-y divide-edge/5"
            >
              <li
                v-for="(e, i) in recentEntries"
                :key="e.id"
                class="flex items-center justify-between gap-3 rounded-xl px-2 py-3 transition-colors duration-200 hover:bg-edge/5"
                :style="{ transitionDelay: `${i * 60}ms` }"
              >
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
                    <span class="font-mono text-xs text-ink-faint tnum">{{ formatDate(e.date) }}</span>
                  </div>
                </div>
                <span class="whitespace-nowrap font-mono font-semibold text-ink tnum">
                  {{ formatMoney(e.amount) }}
                </span>
              </li>
            </TransitionGroup>

            <!-- First-run: ghost rows preview the list shape (ROADMAP §3). -->
            <EmptyEntries v-else class="mt-2" @action="openQuickAdd()" />
          </WidgetBoundary>
        </div>
      </section>
    </template>

    <!-- Monthly budget editor + first-run onboarding (client-only). Budget now
         persists to the DB (Profile.monthlyBudget) via /api/settings. -->
    <ClientOnly>
      <EditBudgetModal
        :open="budgetModalOpen"
        :current-income="stats?.monthlyIncome ?? 0"
        @close="budgetModalOpen = false"
        @saved="onBudgetSaved"
      />
      <!-- Unskippable: shows until a new user sets their monthly budget. -->
      <WelcomeModal v-if="needsOnboarding" @saved="onBudgetSaved" />
      <AddCategoryModal :open="addCategoryModalOpen" @close="addCategoryModalOpen = false" />
      <ManageCategoriesModal :open="manageCategoriesOpen" @close="manageCategoriesOpen = false" />
    </ClientOnly>
  </div>
</template>

<style scoped>
/* Staggered cascade for the recent-entries list: each row fades up in turn
   (the per-row transition-delay is set inline from its index). */
.recent-enter-active {
  transition: opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}
.recent-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.recent-leave-active {
  transition: opacity 0.2s ease;
}
.recent-leave-to {
  opacity: 0;
}

/* Guided hero: a soft accent halo pulses off the N keycap, drawing the eye to
   the one action a fresh account has. The global reduced-motion rule zeroes
   animation-duration, collapsing this to a static (invisible) ring. */
.key-hint::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  border: 2px solid rgb(var(--accent) / 0.5);
  animation: key-pulse 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
  pointer-events: none;
}
@keyframes key-pulse {
  0% {
    opacity: 0.7;
    transform: scale(0.92);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(1.18);
  }
}
</style>
