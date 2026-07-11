<script setup lang="ts">
// The default layout wraps every page: the floating brand chip, the "focus
// stage" that holds page content, the bottom dock, and the toast host.
// A page's markup renders where <slot /> sits.
//
// It also owns the two global quick-add pieces:
//   1. One app-wide <ExpenseForm> drawer instance, driven by useQuickAdd().
//   2. The "N" keyboard shortcut that opens it from anywhere — unless the
//      user is typing in a form control, or another dialog is already open.
//
// The focus stage: while any drawer/dialog is open (useFocusStage), the main
// content scales down and blurs, so the overlay owns the eye.
import { Flame } from 'lucide-vue-next'

const { isOpen: quickAddOpen, open: openQuickAdd, close: closeQuickAdd } = useQuickAdd()
const { engaged: stageDimmed } = useFocusStage()
const { init: initTheme } = useTheme()
const { init: initCurrency } = useCurrency()
const { formatMonthLabel } = useFormatters()

// Logging streak (ROADMAP §4): consecutive days with an entry, from the
// shared 90-day pool. Client-only data, so the chip mounts inside ClientOnly.
const { streak, label: streakLabel, loaded: streakLoaded } = useStreak()
const streakTitle = computed(() =>
  streak.value > 0
    ? `Logging streak: ${streak.value} consecutive ${streak.value === 1 ? 'day' : 'days'} with an entry`
    : 'No active streak — log an expense to start one'
)

// True when the keydown originated inside anything that accepts typing.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest('input, textarea, select, [contenteditable="true"]')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key.toLowerCase() !== 'n') return
  if (e.ctrlKey || e.metaKey || e.altKey) return // leave browser shortcuts alone
  if (isTypingTarget(e.target)) return
  // Don't open on top of an already-open dialog (edit drawer, delete confirm…).
  if (document.querySelector('[role="dialog"]')) return
  e.preventDefault()
  openQuickAdd()
}

onMounted(() => {
  // Sync Vue's theme state with the class the inline head script applied,
  // and restore the saved display currency (USD/PHP).
  initTheme()
  initCurrency()
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="relative min-h-screen overflow-x-clip">
    <!-- Skip link (A11y sweep, ROADMAP §5): first tab stop on every page.
         sr-only until keyboard focus lands on it, then it pops in above the
         floating header so keyboard users can jump past the chrome. -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-emerald-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg"
    >
      Skip to main content
    </a>

    <!-- Paper-grain texture: a tiled SVG fractal-noise data URI over the
         body background. Fixed, click-through, behind all content; opacity
         lives in classes (not inline) so the dark: variant can win. -->
    <div
      class="pointer-events-none fixed inset-0 -z-10 opacity-[0.13] dark:opacity-[0.06]"
      aria-hidden="true"
      style="background-image: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E&quot;)"
    />

    <!-- ── Floating brand chip + month ──────────────────────────────── -->
    <header
      class="pointer-events-none fixed inset-x-0 z-40 flex items-center justify-between px-4 top-[calc(1rem+env(safe-area-inset-top))] sm:px-6 sm:top-[calc(1.5rem+env(safe-area-inset-top))]"
    >
      <NuxtLink
        to="/"
        class="glass pointer-events-auto flex items-center gap-2.5 rounded-full py-2 pl-3 pr-4 transition-colors duration-200 hover:border-black/15 dark:hover:border-white/20"
      >
        <!-- Inlined logo.svg: the shield keeps its static brand greens; the
             wordmark uses currentColor so text-ink flips it per theme. -->
        <svg
          viewBox="0 0 300 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          class="h-8 w-auto text-ink"
          role="img"
          aria-label="Vaulted Logo"
        >
          <g>
            <path d="M 25 28 Q 50 8 75 28" stroke="#00A859" stroke-width="7" stroke-linecap="round"/>
            <path d="M 12 32 C 12 65 30 90 50 98 C 70 90 88 65 88 32 L 74 36 C 70 60 60 80 50 86 C 40 80 30 60 26 36 Z" fill="#004B36"/>
            <circle cx="50" cy="52" r="12" stroke="#00A859" stroke-width="4"/>
            <circle cx="50" cy="52" r="4" fill="#00A859"/>
            <line x1="50" y1="30" x2="50" y2="36" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
            <line x1="50" y1="68" x2="50" y2="74" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
            <line x1="30" y1="52" x2="36" y2="52" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
            <line x1="64" y1="52" x2="70" y2="52" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
          </g>
          <text x="100" y="70" font-family="'Inter', system-ui, sans-serif" font-weight="800" font-size="48" fill="currentColor" letter-spacing="-1">Vaulted</text>
        </svg>
      </NuxtLink>

      <div class="flex items-center gap-2">
        <!-- Logging streak: small mono counter. A broken streak just grays
             out (flame included) — no red, no shame. -->
        <ClientOnly>
          <span
            v-if="streakLoaded"
            class="glass pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 font-mono text-xs tnum"
            :class="streak > 0 ? 'text-ink-soft' : 'text-ink-faint'"
            :title="streakTitle"
            :aria-label="streakTitle"
          >
            <Flame
              class="h-3.5 w-3.5"
              :class="streak > 0 ? 'text-positive' : 'text-ink-faint'"
              aria-hidden="true"
            />
            {{ streakLabel }}
          </span>
        </ClientOnly>
        <span class="glass rounded-full px-4 py-2 font-mono text-xs text-ink-soft tnum">
          {{ formatMonthLabel() }}
        </span>
        <!-- Account chip: email, theme/currency shortcuts, edit budget, sign out. -->
        <AccountMenu />
      </div>
    </header>

    <!-- ── Focus stage: page content ────────────────────────────────── -->
    <!-- id + tabindex="-1": the skip link's target — focusable by the anchor
         jump, never in the tab order. outline-none because a whole-page
         outline on that programmatic focus would just be noise. -->
    <main
      id="main-content"
      tabindex="-1"
      class="relative mx-auto w-full max-w-6xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-24 outline-none transition-all duration-500 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] sm:px-6 sm:pt-28"
      :class="stageDimmed && 'scale-[0.98] opacity-70 blur-[4px]'"
    >
      <slot />

      <footer class="mt-16">
        <div class="hairline" />
        <p class="mt-5 text-center font-mono text-xs text-ink-faint">
          Vaulted · Secure Today. Empower Tomorrow. · press
          <kbd class="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono dark:border-white/15 dark:bg-white/5">N</kbd>
          to add an expense ·
          <kbd class="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono dark:border-white/15 dark:bg-white/5">Ctrl K</kbd>
          for commands
        </p>
      </footer>
    </main>

    <!-- ── Floating dock navigation ─────────────────────────────────── -->
    <AppDock />

    <!-- Global quick-add drawer — one instance for the whole app.
         Creates are optimistic: the form closes instantly, shows the entry
         via useOptimisticExpenses, and busts the spending caches itself
         (refreshSpendingCaches) once the POST lands — no @saved wiring. -->
    <ExpenseForm
      :open="quickAddOpen"
      :editing="null"
      @close="closeQuickAdd()"
    />

    <!-- Command palette (Ctrl/Cmd+K) — one instance, reachable everywhere.
         The global shortcut listener lives inside the component. -->
    <CommandPalette />

    <!-- Month-end report card modal — opened from /analytics or the palette. -->
    <MonthReportCard />

    <!-- Toast notifications render here, on top of everything. -->
    <AppToasts />
  </div>
</template>
