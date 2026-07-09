<script setup lang="ts">
// Command palette (ROADMAP §2, Ctrl+K).
// A teleported overlay with a single text input, fuzzy-matched over routes
// and actions: navigation, quick-add, the month report card, theme, and the
// display-currency switch. Hosted once in layouts/default.vue; opened with
// Ctrl/Cmd+K from anywhere (the listener lives here).
//
// Accessibility: role="dialog" + the shared focus trap (page behind goes
// inert, Escape closes only this layer, focus returns to the trigger), and
// the input drives the results list through the combobox/listbox pattern
// with aria-activedescendant.
import {
  BarChart3,
  Coins,
  LayoutDashboard,
  Moon,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Sun
} from 'lucide-vue-next'
import type { Component } from 'vue'

interface Command {
  id: string
  label: string
  /** Extra fuzzy-match fodder that isn't part of the visible label. */
  keywords: string
  /** Small right-aligned detail (shortcut, currency symbol…). */
  hint?: string
  section: 'Navigate' | 'Actions' | 'Currency'
  icon: Component
  run: () => void
}

const { isOpen, close, toggle } = useCommandPalette()
const { open: openQuickAdd } = useQuickAdd()
const { open: openReport } = useReportCard()
const { isDark, toggle: toggleTheme } = useTheme()
const { active: activeCurrency, set: setCurrency } = useCurrency()
const { acquire, release } = useFocusStage()

const panel = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const query = ref('')
const activeIndex = ref(0)
const listId = useId()

const trap = useFocusTrap(panel, () => close())

// --- The commands ---------------------------------------------------------
// A computed so labels stay live (theme direction, active currency).
const commands = computed<Command[]>(() => [
  {
    id: 'nav-dashboard',
    label: 'Go to Dashboard',
    keywords: 'home overview stats',
    hint: '/',
    section: 'Navigate',
    icon: LayoutDashboard,
    run: () => navigateTo('/')
  },
  {
    id: 'nav-analytics',
    label: 'Go to Analytics',
    keywords: 'charts calendar trends compare deep dive',
    hint: '/analytics',
    section: 'Navigate',
    icon: BarChart3,
    run: () => navigateTo('/analytics')
  },
  {
    id: 'nav-expenses',
    label: 'Go to Expenses',
    keywords: 'list table entries transactions history',
    hint: '/expenses',
    section: 'Navigate',
    icon: ReceiptText,
    run: () => navigateTo('/expenses')
  },
  {
    id: 'act-add',
    label: 'Add expense',
    keywords: 'new create quick log entry',
    hint: 'N',
    section: 'Actions',
    icon: Plus,
    run: () => openQuickAdd()
  },
  {
    id: 'act-report',
    label: 'Month report card',
    keywords: 'share wrapped summary png download',
    section: 'Actions',
    icon: Sparkles,
    run: () => openReport()
  },
  {
    id: 'act-theme',
    label: isDark.value ? 'Switch to light mode' : 'Switch to dark mode',
    keywords: 'theme toggle dark light appearance',
    section: 'Actions',
    icon: isDark.value ? Sun : Moon,
    run: () => toggleTheme()
  },
  ...CURRENCY_OPTIONS.map((o) => ({
    id: `cur-${o.code}`,
    label: `Display in ${o.label}`,
    keywords: `currency money convert ${o.code}`,
    hint: activeCurrency.value === o.code ? `${o.symbol} · active` : o.symbol,
    section: 'Currency' as const,
    icon: Coins,
    run: () => setCurrency(o.code)
  }))
])

// --- Fuzzy matching --------------------------------------------------------
// Classic subsequence scorer: every query char must appear in order; runs of
// consecutive matches and word-start hits score higher. Null = no match.
function fuzzyScore(rawQuery: string, target: string): number | null {
  const q = rawQuery.toLowerCase().replace(/\s+/g, '')
  const t = target.toLowerCase()
  if (!q) return 0
  let qi = 0
  let streak = 0
  let score = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) {
      streak = 0
      continue
    }
    streak++
    const wordStart = ti === 0 || /[\s\-/·]/.test(t[ti - 1])
    score += 1 + streak + (wordStart ? 6 : 0)
    qi++
  }
  return qi === q.length ? score : null
}

const results = computed(() => {
  if (!query.value.trim()) return commands.value
  return commands.value
    .map((cmd, order) => ({
      cmd,
      order,
      score: fuzzyScore(query.value, `${cmd.label} ${cmd.keywords}`)
    }))
    .filter((r) => r.score !== null)
    .sort((a, b) => b.score! - a.score! || a.order - b.order)
    .map((r) => r.cmd)
})

// Show section eyebrows only while browsing (empty query keeps the list in
// section order; a ranked search reads better flat).
const showSections = computed(() => !query.value.trim())
function sectionBefore(i: number): string | null {
  if (!showSections.value) return null
  const cur = results.value[i].section
  return i === 0 || results.value[i - 1].section !== cur ? cur : null
}

watch(results, () => {
  activeIndex.value = 0
})

// Keep the active option in view while arrowing through a long list.
watch(activeIndex, async (i) => {
  await nextTick()
  listEl.value
    ?.querySelector(`[data-index="${i}"]`)
    ?.scrollIntoView({ block: 'nearest' })
})

// --- Running a command -----------------------------------------------------
// Close first so the focus trap unwinds (and focus returns to the trigger)
// BEFORE the command opens its own overlay or navigates.
async function run(cmd: Command) {
  close()
  await nextTick()
  cmd.run()
}

function onInputKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault()
    const n = results.value.length
    if (n === 0) return
    const step = e.key === 'ArrowDown' ? 1 : -1
    activeIndex.value = (activeIndex.value + step + n) % n
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = results.value[activeIndex.value]
    if (cmd) void run(cmd)
  }
}

// --- Open/close plumbing (same shape as Modal/Drawer) ----------------------
let held = false
function engage() {
  if (held) return
  held = true
  query.value = ''
  activeIndex.value = 0
  acquire()
  document.body.style.overflow = 'hidden'
  trap.activate()
  // After the trap's own focus tick, move focus onto the input.
  nextTick(() => inputEl.value?.focus())
}
function disengage() {
  if (!held) return
  held = false
  release()
  document.body.style.overflow = ''
  trap.deactivate()
}

watch(
  () => isOpen.value,
  (open) => {
    if (import.meta.server) return
    open ? engage() : disengage()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (import.meta.server) return
  disengage()
})

// The global shortcut. Ctrl/Cmd+K works even while typing in a field —
// that's the convention — and toggles, so the same chord closes the palette.
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    toggle()
  }
}
onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <!-- ClientOnly: teleporting to <body> during SSR causes hydration
       mismatches, and the palette only ever opens after a keypress. -->
  <ClientOnly>
    <Teleport to="body">
      <Transition name="overlay">
        <div
          v-if="isOpen"
          class="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-zinc-950/25 p-4 pt-[16vh] backdrop-blur-sm dark:bg-black/60"
          @click.self="close()"
        >
          <div
            ref="panel"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            tabindex="-1"
            class="w-full max-w-lg origin-top animate-pop overflow-hidden rounded-2xl border border-black/5 bg-white shadow-xl outline-none dark:border-white/10 dark:bg-zinc-900"
          >
            <!-- Search input -->
            <div class="flex items-center gap-3 px-4 py-3.5">
              <Search class="h-4 w-4 shrink-0 text-ink-faint" aria-hidden="true" />
              <input
                ref="inputEl"
                v-model="query"
                type="text"
                role="combobox"
                aria-expanded="true"
                :aria-controls="listId"
                :aria-activedescendant="results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined"
                aria-label="Search commands"
                placeholder="Type a command or search…"
                autocomplete="off"
                spellcheck="false"
                class="w-full bg-transparent text-sm text-ink outline-none ring-0 placeholder:text-ink-faint focus-visible:ring-0"
                @keydown="onInputKeydown"
              />
              <kbd
                class="shrink-0 rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-[0.65rem] text-ink-faint dark:border-white/15 dark:bg-white/5"
              >
                esc
              </kbd>
            </div>

            <div class="hairline" />

            <!-- Results -->
            <div :id="listId" ref="listEl" role="listbox" class="max-h-80 overflow-y-auto p-2">
              <template v-for="(cmd, i) in results" :key="cmd.id">
                <p v-if="sectionBefore(i)" class="eyebrow px-3 pb-1.5 pt-3 first:pt-1.5">
                  {{ sectionBefore(i) }}
                </p>
                <button
                  :id="`${listId}-${cmd.id}`"
                  type="button"
                  role="option"
                  :aria-selected="i === activeIndex"
                  :data-index="i"
                  tabindex="-1"
                  class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors duration-100"
                  :class="
                    i === activeIndex
                      ? 'bg-black/5 text-ink dark:bg-white/10'
                      : 'text-ink-soft'
                  "
                  @mousemove="activeIndex = i"
                  @click="run(cmd)"
                >
                  <component
                    :is="cmd.icon"
                    class="h-4 w-4 shrink-0"
                    :class="i === activeIndex ? 'text-positive' : 'text-ink-faint'"
                    aria-hidden="true"
                  />
                  <span class="flex-1 truncate font-medium">{{ cmd.label }}</span>
                  <span v-if="cmd.hint" class="shrink-0 font-mono text-xs text-ink-faint">
                    {{ cmd.hint }}
                  </span>
                </button>
              </template>

              <p v-if="results.length === 0" class="px-3 py-8 text-center text-sm text-ink-faint">
                No matching commands.
              </p>
            </div>

            <div class="hairline" />

            <!-- Key hints -->
            <p class="flex items-center gap-4 px-4 py-2.5 font-mono text-[0.65rem] text-ink-faint">
              <span><kbd class="font-mono">↑↓</kbd> navigate</span>
              <span><kbd class="font-mono">↵</kbd> run</span>
              <span><kbd class="font-mono">esc</kbd> close</span>
            </p>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
