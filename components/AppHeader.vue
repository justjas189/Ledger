<script setup lang="ts">
// The global top bar: wordmark on the left, primary navigation on the right.
// It sits in the default layout, so it appears on every page.
const route = useRoute()
const { formatMonthLabel } = useFormatters()

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/expenses', label: 'Expenses' }
]

// A link is active when the current path matches (exact for the dashboard,
// prefix for sections like /expenses/...).
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to)
</script>

<template>
  <header class="sticky top-0 z-40 bg-paper/85 backdrop-blur">
    <div
      class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 double-rule sm:px-6"
    >
      <!-- Wordmark -->
      <NuxtLink to="/" class="group flex items-baseline gap-2">
        <span
          class="font-display text-2xl font-semibold leading-none tracking-tight text-pine"
        >
          Ledger
        </span>
        <span
          class="hidden font-mono text-[0.65rem] uppercase tracking-[0.2em] text-ink-soft sm:inline"
        >
          Expense&nbsp;Book
        </span>
      </NuxtLink>

      <!-- Nav + current month -->
      <div class="flex items-center gap-1 sm:gap-2">
        <span
          class="mr-2 hidden font-mono text-xs text-ink-soft tnum md:inline"
        >
          {{ formatMonthLabel() }}
        </span>
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(link.to)
              ? 'bg-ledger text-pine'
              : 'text-ink-soft hover:bg-ledger/60 hover:text-ink'
          "
        >
          {{ link.label }}
        </NuxtLink>
      </div>
    </div>
  </header>
</template>
