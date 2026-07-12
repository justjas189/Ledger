<script setup lang="ts">
// Savings goals card (ROADMAP §4, Retention).
// One radial gauge per goal, reusing the BudgetRings visual language — same
// geometry, same theme-variable track, same sweep-in — but inverted framing:
// the arc FILLS toward the target in the accent color and never turns rose.
// Reaching 100% earns a quiet "saved" chip, not a warning.
//
// Two flavours share the grid (one model, one ledger — see schema.prisma):
//   • Targeted goal   — progress = totalSaved / target, plus the deadline
//     countdown ("X days left", from targetDate).
//   • Open-ended fund — target/targetDate are null: no %, no countdown. The
//     ring renders as a soft full accent circle with a piggy-bank center, and
//     the money line shows the running balance instead of "x / y".
// totalSaved is aggregated server-side from the contributions ledger
// (SavingsContribution). Each card also shows how much was put aside THIS
// month (thisMonthSaved) — Vaulted's month-to-month lens. Creating either
// flavour lives in NewGoalModal; "Add funds" appends a contribution.
import { PiggyBank, Plus, X } from 'lucide-vue-next'
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'
import type { SavingsGoalDTO } from '~/types/expense'

const { goals, loaded, pending, load, contribute, removeGoal } = useSavingsGoals()
if (import.meta.client) void load()

const { active, rates } = useCurrency()
const { formatMoney } = useFormatters()
const toast = useToast()

const symbol = computed(
  () => CURRENCY_OPTIONS.find((o) => o.code === active.value)?.symbol ?? '$'
)

// Same ring geometry as ChartsBudgetRings, so the two cards read as one family.
const SIZE = 120
const THICKNESS = 9
const R = (SIZE - THICKNESS) / 2
const C = 2 * Math.PI * R

// Ids in their post-delete Undo window: hidden from the grid but not yet
// deleted server-side (the DELETE fires when the window closes).
const removing = ref<Set<string>>(new Set())

// Whole-day countdown to a deadline, compared in UTC calendar days (targetDate
// is stored as UTC midnight) so the number doesn't drift with time-of-day.
function dayDiff(iso: string): number {
  const t = new Date(iso)
  const target = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.round((target - today) / 86_400_000)
}
function deadlineLabel(days: number): string {
  if (days > 1) return `${days} days left`
  if (days === 1) return '1 day left'
  if (days === 0) return 'Due today'
  if (days === -1) return '1 day over'
  return `${Math.abs(days)} days over`
}

const rows = computed(() =>
  goals.value
    .filter((g) => !removing.value.has(g.id))
    .map((g) => {
      // null target = open-ended fund: no %, no finish line, no countdown.
      const open = g.target === null
      const pct = g.target !== null && g.target > 0 ? (g.totalSaved / g.target) * 100 : 0
      const days = g.targetDate !== null ? dayDiff(g.targetDate) : null
      return {
        ...g,
        open,
        pct,
        done: !open && pct >= 100,
        // The visible arc caps at a full circle. An open fund draws the full
        // circle (softened in the template) — a vessel, not a progress bar.
        dash: open ? C : Math.min(pct / 100, 1) * C,
        days,
        // A target without a deadline is reachable via the API; label it
        // rather than pretending a countdown exists.
        deadline: open ? 'Open-ended' : days !== null ? deadlineLabel(days) : 'No deadline',
        // Overdue only matters while there's still money to save.
        overdue: days !== null && days < 0 && pct < 100
      }
    })
)

// Rings start empty and sweep to their value one frame after mount, so the
// CSS transition on stroke-dashoffset has something to animate from.
const drawn = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    drawn.value = true
  })
})

// --- Create dialog (its own component) -------------------------------------
const createOpen = ref(false)

// --- Add-funds dialog (appends a contribution) -----------------------------
const fundGoal = ref<SavingsGoalDTO | null>(null)
const amountInput = ref('')
const fundError = ref('')
const submitting = ref(false)

const fundTitle = computed(() => (fundGoal.value ? `Add to "${fundGoal.value.name}"` : 'Add funds'))

function openContribute(goal: SavingsGoalDTO) {
  amountInput.value = ''
  fundError.value = ''
  fundGoal.value = goal
}

function closeContribute() {
  if (submitting.value) return
  fundGoal.value = null
}

async function submitContribute() {
  if (!fundGoal.value || submitting.value) return
  const amount = Number(amountInput.value)
  if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
    fundError.value = 'Enter an amount greater than 0.'
    return
  }
  // Entered in the active display currency → back to base USD at today's rate.
  const usd = amount / rates.value[active.value]
  fundError.value = ''
  submitting.value = true
  try {
    const updated = await contribute(fundGoal.value.id, usd)
    if (updated.target !== null && updated.totalSaved >= updated.target) {
      toast.success(`"${updated.name}" reached — nicely done.`)
    } else if (updated.target === null) {
      toast.success('Added to your fund.')
    } else {
      toast.success('Added to your goal.')
    }
    fundGoal.value = null
  } catch {
    fundError.value = 'Could not save. Please try again.'
  } finally {
    submitting.value = false
  }
}

// --- Delete with an Undo window --------------------------------------------
// The same forgiving pattern as expense deletion: the row vanishes instantly,
// but the actual DELETE only fires once the Undo window closes, so Undo needs
// no re-creation (the goal — and its ledger — never left the DB).
const removeTimers = new Map<string, ReturnType<typeof setTimeout>>()

function hide(id: string, hidden: boolean) {
  const next = new Set(removing.value)
  if (hidden) next.add(id)
  else next.delete(id)
  removing.value = next
}

function onRemove(goal: SavingsGoalDTO) {
  hide(goal.id, true)
  removeTimers.set(
    goal.id,
    setTimeout(() => void commitRemove(goal.id), 5000)
  )
  toast.info(`"${goal.name}" removed.`, {
    duration: 5000,
    action: { label: 'Undo', onAction: () => undoRemove(goal.id) }
  })
}

async function commitRemove(id: string) {
  removeTimers.delete(id)
  try {
    await removeGoal(id)
  } catch {
    // Delete failed — bring the row back so nothing is silently lost.
    hide(id, false)
    toast.error('Could not remove the goal.')
  }
}

function undoRemove(id: string) {
  const t = removeTimers.get(id)
  if (t) clearTimeout(t)
  removeTimers.delete(id)
  hide(id, false)
}

// Leaving the page with an Undo still open cancels the pending delete (the goal
// stays) rather than committing it behind the user's back.
onBeforeUnmount(() => {
  for (const t of removeTimers.values()) clearTimeout(t)
  removeTimers.clear()
})
</script>

<template>
  <section class="glass-card p-6">
    <div class="flex items-center justify-between gap-3">
      <p class="eyebrow">Savings goals</p>
      <button type="button" class="btn btn-ghost !px-3 !py-1.5 text-xs" @click="createOpen = true">
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        New goal
      </button>
    </div>

    <!-- Initial load: a quiet skeleton row so the card doesn't flash empty. -->
    <div v-if="pending && !loaded" class="mt-6 flex justify-center gap-6">
      <div v-for="n in 3" :key="n" class="skeleton h-[120px] w-[120px] rounded-full" />
    </div>

    <!-- Goals as rings -->
    <ul
      v-else-if="rows.length"
      class="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6"
    >
      <li
        v-for="(g, i) in rows"
        :key="g.id"
        class="group relative flex flex-col items-center text-center"
      >
        <button
          type="button"
          class="absolute -right-1 -top-1 z-10 grid h-6 w-6 place-items-center rounded-full text-ink-faint opacity-0 transition-opacity duration-200 hover:bg-edge/10 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
          :aria-label="`Remove goal ${g.name}`"
          @click="onRemove(g)"
        >
          <X class="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        <div class="relative">
          <svg
            :width="SIZE"
            :height="SIZE"
            :viewBox="`0 0 ${SIZE} ${SIZE}`"
            role="img"
            :aria-label="
              g.open
                ? `${g.name}: ${formatMoney(g.totalSaved)} saved, open-ended fund`
                : `${g.name}: ${g.pct.toFixed(0)}% of target saved${g.done ? ' — goal reached' : ''}, ${g.deadline}`
            "
            class="transition-transform duration-300 group-hover:scale-105"
          >
            <g :transform="`rotate(-90 ${SIZE / 2} ${SIZE / 2})`">
              <!-- Track -->
              <circle
                :cx="SIZE / 2"
                :cy="SIZE / 2"
                :r="R"
                fill="none"
                style="stroke: rgb(var(--ink) / 0.08)"
                :stroke-width="THICKNESS"
              />
              <!-- Progress arc: always the accent — goals celebrate, never warn.
                   An open fund draws the FULL circle, softened: a vessel that
                   holds money, not a bar that finishes. -->
              <circle
                :cx="SIZE / 2"
                :cy="SIZE / 2"
                :r="R"
                fill="none"
                :stroke-width="THICKNESS"
                stroke-linecap="round"
                :stroke-dasharray="`${C} ${C}`"
                :stroke-dashoffset="drawn ? C - g.dash : C"
                :style="{
                  stroke: 'rgb(var(--accent-strong))',
                  strokeOpacity: g.open ? 0.35 : 1,
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 90}ms`
                }"
              />
            </g>
          </svg>

          <!-- Center readout — decorative for AT: the SVG's aria-label already
               announces the state, and the text below carries the money. An
               open fund has no meaningful % — a piggy bank marks the vessel. -->
          <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <template v-if="g.open">
              <PiggyBank class="h-6 w-6" style="color: rgb(var(--accent-strong))" />
            </template>
            <template v-else>
              <span class="font-mono text-base font-semibold text-ink tnum">
                {{ Math.min(g.pct, 999).toFixed(0) }}%
              </span>
              <span
                v-if="g.done"
                class="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-widest text-positive"
              >
                saved
              </span>
            </template>
          </div>
        </div>

        <p class="mt-2 max-w-[9rem] truncate text-sm font-medium text-ink">{{ g.name }}</p>
        <!-- Targeted: progress over target. Open fund: just the balance. -->
        <p class="font-mono text-xs text-ink-faint tnum">
          <template v-if="g.target !== null">
            {{ formatMoney(g.totalSaved) }} / {{ formatMoney(g.target) }}
          </template>
          <template v-else>{{ formatMoney(g.totalSaved) }} saved</template>
        </p>

        <!-- Deadline countdown: neutral normally, rose once overdue + unmet. -->
        <p
          class="mt-0.5 text-[0.7rem] font-medium"
          :class="g.overdue ? 'text-negative' : 'text-ink-faint'"
        >
          {{ g.deadline }}
        </p>

        <!-- This-month contribution badge — only when something landed. -->
        <span
          v-if="g.thisMonthSaved > 0"
          class="mt-1.5 rounded-full bg-positive/10 px-2 py-0.5 font-mono text-[0.65rem] font-semibold text-positive tnum"
          :title="`Added this month`"
        >
          +{{ formatMoney(g.thisMonthSaved) }} this month
        </span>

        <button
          type="button"
          class="mt-1.5 rounded-full border border-black/10 px-2.5 py-0.5 font-mono text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-black/5 hover:text-ink dark:border-white/15 dark:hover:bg-white/10"
          @click="openContribute(g)"
        >
          + Add
        </button>
      </li>
    </ul>

    <!-- Empty state (ROADMAP §3): a ghost ring at 68% previews exactly what a
         goal looks like, reusing this card's own ring geometry. Decorative —
         the copy + CTA underneath carry the message. -->
    <div v-else class="py-6 text-center">
      <div class="relative inline-block" aria-hidden="true">
        <span
          class="pointer-events-none absolute -right-14 top-0 rounded-full border border-edge/10 bg-edge/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-ink-faint"
        >
          Sample
        </span>
        <svg :width="SIZE" :height="SIZE" :viewBox="`0 0 ${SIZE} ${SIZE}`">
          <g :transform="`rotate(-90 ${SIZE / 2} ${SIZE / 2})`">
            <circle
              :cx="SIZE / 2"
              :cy="SIZE / 2"
              :r="R"
              fill="none"
              style="stroke: rgb(var(--ink) / 0.06)"
              :stroke-width="THICKNESS"
            />
            <circle
              :cx="SIZE / 2"
              :cy="SIZE / 2"
              :r="R"
              fill="none"
              :stroke-width="THICKNESS"
              stroke-linecap="round"
              :stroke-dasharray="`${C} ${C}`"
              :stroke-dashoffset="drawn ? C - 0.68 * C : C"
              style="
                stroke: rgb(var(--accent) / 0.35);
                transition: stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1);
              "
            />
          </g>
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center">
          <span class="font-mono text-base font-semibold text-ink-faint tnum">68%</span>
        </div>
      </div>
      <p class="mt-1 font-mono text-xs text-ink-faint tnum">
        {{ formatMoney(680) }} / {{ formatMoney(1000) }}
      </p>
      <p class="mx-auto mt-3 max-w-sm text-sm text-ink-soft">
        No goals yet — pick a target and watch the ring fill toward it, like this.
        Open-ended funds work too.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="createOpen = true">
        Set your first goal
      </button>
    </div>

    <!-- Create dialog -->
    <NewGoalModal :open="createOpen" @close="createOpen = false" />

    <!-- Add-funds dialog -->
    <Modal :open="fundGoal !== null" :title="fundTitle" @close="closeContribute()">
      <form class="space-y-5" novalidate @submit.prevent="submitContribute">
        <div>
          <label for="fund-amount" class="label">Amount to add</label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
            >
              {{ symbol }}
            </span>
            <input
              id="fund-amount"
              v-model="amountInput"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-8 font-mono tnum"
              :class="{ 'field-invalid': fundError }"
              placeholder="0.00"
            />
          </div>
          <p v-if="fundError" class="mt-1 text-xs text-negative">{{ fundError }}</p>
          <p v-else-if="active !== 'USD'" class="mt-1 text-xs text-ink-faint">
            Entered in {{ active }} — stored in USD at today's rate, like every amount.
          </p>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn btn-ghost" :disabled="submitting" @click="closeContribute()">
          Cancel
        </button>
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="submitContribute()">
          {{ submitting ? 'Saving…' : 'Add funds' }}
        </button>
      </template>
    </Modal>
  </section>
</template>
