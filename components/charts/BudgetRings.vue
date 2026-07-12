<script setup lang="ts">
// Budget rings — one radial gauge per category.
// Every ring draws its arc in the single accent color (the value is the
// message, not the category — identity sits in the label underneath) and
// flips to the semantic rose with a warning chip once spending crosses the
// line. Track and strokes come from theme variables, so the rings adapt to
// light and dark automatically.
// The arc animates by transitioning stroke-dashoffset, so rings sweep in on
// load and re-sweep whenever the data changes.
import type { BudgetComparison } from '~/types/expense'

const props = defineProps<{
  budgets: BudgetComparison[]
}>()

const { formatMoney } = useFormatters()
const { categoryColor } = useCategoryColors()
const { resolveIcon, getCategoryIcon } = useCategoryIcons()

const SIZE = 120
const THICKNESS = 9
const R = (SIZE - THICKNESS) / 2
const C = 2 * Math.PI * R

const rows = computed(() =>
  props.budgets
    .filter((b) => b.budget > 0)
    .map((b) => {
      const pct = (b.spent / b.budget) * 100
      return {
        ...b,
        pct,
        over: pct > 100,
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

// Each ring drills down into /expenses pre-filtered to its category and the
// dashboard's month (first → last day, local time — the same calendar the
// stats buckets use). The expenses page reads these query params on load.
const pad = (n: number) => String(n).padStart(2, '0')
const monthRange = computed(() => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: `${y}-${pad(m + 1)}-${pad(new Date(y, m + 1, 0).getDate())}`
  }
})
const drilldownTo = (categoryId: string) => ({
  path: '/expenses',
  query: { categoryId, from: monthRange.value.from, to: monthRange.value.to }
})
</script>

<template>
  <ul class="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
    <li v-for="(b, i) in rows" :key="b.categoryId" class="flex justify-center">
      <!-- The whole ring is a drill-down link into the filtered expenses list.
           The SVG keeps its own aria-label, so the link names the action. -->
      <NuxtLink
        :to="drilldownTo(b.categoryId)"
        class="group flex flex-col items-center rounded-2xl px-2 py-1 text-center transition-colors duration-200 hover:bg-edge/5"
        :aria-label="`View ${b.name} expenses for this month`"
        :title="`View ${b.name} expenses for this month`"
      >
      <div class="relative">
        <svg
          :width="SIZE"
          :height="SIZE"
          :viewBox="`0 0 ${SIZE} ${SIZE}`"
          role="img"
          :aria-label="`${b.name}: ${b.pct.toFixed(0)}% of budget used${b.over ? ' — over budget' : ''}`"
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
            <!-- Value arc: accent when healthy, rose when over budget. -->
            <circle
              :cx="SIZE / 2"
              :cy="SIZE / 2"
              :r="R"
              fill="none"
              :stroke-width="THICKNESS"
              stroke-linecap="round"
              :stroke-dasharray="`${C} ${C}`"
              :stroke-dashoffset="drawn ? C - b.dash : C"
              :style="{
                stroke: b.over ? 'rgb(var(--negative))' : 'rgb(var(--accent-strong))',
                transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease',
                transitionDelay: `${i * 90}ms, 0ms`
              }"
            />
          </g>
        </svg>

        <!-- Center readout — decorative for AT: the SVG's aria-label already
             announces the percentage, and the text below carries the money. -->
        <div class="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          <span
            class="font-mono text-base font-semibold tnum"
            :class="b.over ? 'text-negative' : 'text-ink'"
          >
            {{ b.pct.toFixed(0) }}%
          </span>
          <span v-if="b.over" class="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-widest text-negative">
            over
          </span>
        </div>
      </div>

      <p class="mt-2 flex max-w-[9rem] items-center gap-1.5 text-sm font-medium text-ink">
        <span
          class="grid h-5 w-5 shrink-0 place-items-center rounded-full"
          :style="{ backgroundColor: `${categoryColor(b.name, b.color)}29` }"
          aria-hidden="true"
        >
          <component
            :is="resolveIcon(getCategoryIcon(b.name))"
            v-if="resolveIcon(getCategoryIcon(b.name))"
            class="h-3 w-3"
            :style="{ color: categoryColor(b.name, b.color) }"
          />
          <span
            v-else
            class="inline-block h-2 w-2 rounded-full"
            :style="{ backgroundColor: categoryColor(b.name, b.color) }"
          />
        </span>
        <span class="truncate">{{ b.name }}</span>
      </p>
      <p class="font-mono text-xs text-ink-faint tnum">
        {{ formatMoney(b.spent) }} / {{ formatMoney(b.budget) }}
      </p>
      </NuxtLink>
    </li>
  </ul>
</template>
