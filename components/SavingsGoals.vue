<script setup lang="ts">
// Savings goals card (ROADMAP §4, Retention).
// One radial gauge per goal, reusing the BudgetRings visual language — same
// geometry, same theme-variable track, same sweep-in — but inverted framing:
// the arc FILLS toward the target in the accent color and never turns rose.
// Reaching 100% earns a quiet "saved" chip, not a warning.
//
// Data + persistence live in useSavingsGoals (localStorage; the API stays
// locked). Creating a goal and adding to one share the small Modal below.
import { PiggyBank, Plus, X } from 'lucide-vue-next'
import type { SavingsGoal } from '~/composables/useSavingsGoals'

const { goals, load, addGoal, contribute, removeGoal, restoreGoal } = useSavingsGoals()
if (import.meta.client) load()

const { formatMoney } = useFormatters()
const toast = useToast()

// Same ring geometry as ChartsBudgetRings, so the two cards read as one family.
const SIZE = 120
const THICKNESS = 9
const R = (SIZE - THICKNESS) / 2
const C = 2 * Math.PI * R

const rows = computed(() =>
  goals.value.map((g) => {
    const pct = (g.saved / g.target) * 100
    return {
      ...g,
      pct,
      done: pct >= 100,
      // The visible arc caps at a full circle.
      dash: Math.min(pct / 100, 1) * C
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

// --- The add / contribute dialog ------------------------------------------
type DialogState = { mode: 'create' } | { mode: 'contribute'; goal: SavingsGoal } | null

const dialog = ref<DialogState>(null)
const nameInput = ref('')
const amountInput = ref('')
const dialogError = ref('')

const dialogTitle = computed(() =>
  dialog.value?.mode === 'contribute' ? `Add to "${dialog.value.goal.name}"` : 'New savings goal'
)

function openCreate() {
  nameInput.value = ''
  amountInput.value = ''
  dialogError.value = ''
  dialog.value = { mode: 'create' }
}

function openContribute(goal: SavingsGoal) {
  amountInput.value = ''
  dialogError.value = ''
  dialog.value = { mode: 'contribute', goal }
}

function closeDialog() {
  dialog.value = null
}

function submitDialog() {
  if (!dialog.value) return
  const amount = Number(amountInput.value)
  if (!amountInput.value || !Number.isFinite(amount) || amount <= 0) {
    dialogError.value =
      dialog.value.mode === 'create'
        ? 'Enter a target greater than 0.'
        : 'Enter an amount greater than 0.'
    return
  }
  if (dialog.value.mode === 'create') {
    if (!nameInput.value.trim()) {
      dialogError.value = 'Give the goal a name.'
      return
    }
    addGoal(nameInput.value, amount)
    toast.success('Goal added — start filling the ring.')
  } else {
    const goal = dialog.value.goal
    contribute(goal.id, amount)
    const updated = goals.value.find((g) => g.id === goal.id)
    if (updated && updated.saved >= updated.target) {
      toast.success(`"${updated.name}" reached — nicely done.`)
    } else {
      toast.success('Added to your goal.')
    }
  }
  closeDialog()
}

// Delete is instant with an Undo window — the same forgiving pattern as
// expense deletion.
function onRemove(goal: SavingsGoal) {
  removeGoal(goal.id)
  toast.info(`"${goal.name}" removed.`, {
    duration: 5000,
    action: { label: 'Undo', onAction: () => restoreGoal(goal) }
  })
}
</script>

<template>
  <section class="glass-card p-6">
    <div class="flex items-center justify-between gap-3">
      <p class="eyebrow">Savings goals</p>
      <button type="button" class="btn btn-ghost !px-3 !py-1.5 text-xs" @click="openCreate()">
        <Plus class="h-3.5 w-3.5" aria-hidden="true" />
        New goal
      </button>
    </div>

    <!-- Goals as rings -->
    <ul v-if="rows.length" class="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
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
            :aria-label="`${g.name}: ${g.pct.toFixed(0)}% of target saved${g.done ? ' — goal reached' : ''}`"
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
              <!-- Progress arc: always the accent — goals celebrate, never warn. -->
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
                  transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 90}ms`
                }"
              />
            </g>
          </svg>

          <!-- Center readout — decorative for AT: the SVG's aria-label already
               announces the percentage, and the text below carries the money. -->
          <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
            <span class="font-mono text-base font-semibold text-ink tnum">
              {{ Math.min(g.pct, 999).toFixed(0) }}%
            </span>
            <span
              v-if="g.done"
              class="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-widest text-positive"
            >
              saved
            </span>
          </div>
        </div>

        <p class="mt-2 max-w-[9rem] truncate text-sm font-medium text-ink">{{ g.name }}</p>
        <p class="font-mono text-xs text-ink-faint tnum">
          {{ formatMoney(g.saved) }} / {{ formatMoney(g.target) }}
        </p>
        <button
          type="button"
          class="mt-1.5 rounded-full border border-black/10 px-2.5 py-0.5 font-mono text-xs font-medium text-ink-soft transition-colors duration-150 hover:bg-black/5 hover:text-ink dark:border-white/15 dark:hover:bg-white/10"
          @click="openContribute(g)"
        >
          + Add
        </button>
      </li>
    </ul>

    <!-- Empty state: point straight at the action. -->
    <div v-else class="py-8 text-center">
      <PiggyBank class="mx-auto h-6 w-6 text-ink-faint" aria-hidden="true" />
      <p class="mt-3 text-sm text-ink-soft">
        No goals yet — pick a target and watch the ring fill.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="openCreate()">
        Set your first goal
      </button>
    </div>

    <!-- Create / contribute dialog -->
    <Modal :open="dialog !== null" :title="dialogTitle" @close="closeDialog()">
      <form class="space-y-5" novalidate @submit.prevent="submitDialog">
        <div v-if="dialog?.mode === 'create'">
          <label for="goal-name" class="label">Name</label>
          <input
            id="goal-name"
            v-model="nameInput"
            type="text"
            class="field"
            placeholder="e.g. Emergency fund"
            maxlength="60"
          />
        </div>

        <div>
          <label for="goal-amount" class="label">
            {{ dialog?.mode === 'create' ? 'Target amount' : 'Amount to add' }}
          </label>
          <div class="relative">
            <span
              class="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-mono text-sm text-ink-faint"
            >
              $
            </span>
            <input
              id="goal-amount"
              v-model="amountInput"
              type="number"
              inputmode="decimal"
              step="0.01"
              min="0"
              class="field pl-8 font-mono tnum"
              :class="{ 'field-invalid': dialogError }"
              placeholder="0.00"
            />
          </div>
          <p v-if="dialogError" class="mt-1 text-xs text-negative">{{ dialogError }}</p>
        </div>
      </form>

      <template #footer>
        <button type="button" class="btn btn-ghost" @click="closeDialog()">Cancel</button>
        <button type="button" class="btn btn-primary" @click="submitDialog()">
          {{ dialog?.mode === 'create' ? 'Add goal' : 'Add funds' }}
        </button>
      </template>
    </Modal>
  </section>
</template>
