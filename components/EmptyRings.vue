<script setup lang="ts">
// Illustrated empty state for the budget-rings card. Three ghost rings drawn
// with the exact geometry of ChartsBudgetRings, so the sample is an honest
// preview of what the widget becomes once spending lands in categories.
// The illustration is decorative (aria-hidden) — the text carries the message.
const emit = defineEmits<{ action: [] }>()

// Same ring math as the real chart, scaled down a step.
const SIZE = 96
const THICKNESS = 8
const R = (SIZE - THICKNESS) / 2
const C = 2 * Math.PI * R

const samples = [
  { name: 'Food', pct: 62 },
  { name: 'Transport', pct: 38 },
  { name: 'Leisure', pct: 81 }
]

// Ghost rings sweep in like the real ones: start empty, draw one frame after
// mount so the stroke-dashoffset transition has a starting value. The global
// reduced-motion rule zeroes the transition, leaving static rings.
const drawn = ref(false)
onMounted(() => {
  requestAnimationFrame(() => {
    drawn.value = true
  })
})
</script>

<template>
  <div>
    <div class="relative" aria-hidden="true">
      <span
        class="pointer-events-none absolute -top-1 right-0 rounded-full border border-edge/10 bg-edge/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-ink-faint"
      >
        Sample
      </span>

      <div class="flex flex-wrap items-start justify-center gap-x-8 gap-y-4 pt-2">
        <div
          v-for="(s, i) in samples"
          :key="s.name"
          class="flex flex-col items-center"
        >
          <div class="relative">
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
                  :stroke-dashoffset="drawn ? C - (s.pct / 100) * C : C"
                  :style="{
                    stroke: 'rgb(var(--accent) / 0.35)',
                    transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)',
                    transitionDelay: `${i * 90}ms`
                  }"
                />
              </g>
            </svg>
            <div class="absolute inset-0 grid place-items-center">
              <span class="font-mono text-sm font-semibold text-ink-faint tnum">{{ s.pct }}%</span>
            </div>
          </div>
          <p class="mt-1.5 text-xs font-medium text-ink-faint">{{ s.name }}</p>
        </div>
      </div>
    </div>

    <div class="mt-5 text-center">
      <p class="font-medium text-ink">No budgets in motion yet</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
        Every category you spend in gets a ring like these — filling as the month goes,
        turning rose if it runs past its budget.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="emit('action')">
        Log an expense to start
      </button>
    </div>
  </div>
</template>
