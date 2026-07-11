<script setup lang="ts">
// Illustrated empty state for the "Where it went" card. A ghost bubble pack
// mirrors CategoryBubbles' output — bigger bubble, bigger share — so a new
// user sees what the space becomes before any spending exists. Decorative
// only (aria-hidden); the copy underneath carries the message. Bubbles bob
// with the existing `float` keyframe (frozen by the reduced-motion rule).
const emit = defineEmits<{ action: [] }>()

// A hand-packed layout: one dominant slice, a few smaller ones. Labels only
// where a real bubble would fit them.
const bubbles = [
  { cx: 105, cy: 90, r: 54, label: 'Food', pct: '44%', delay: '0s' },
  { cx: 200, cy: 62, r: 36, label: 'Bills', pct: '', delay: '0.7s' },
  { cx: 248, cy: 124, r: 26, label: 'Fun', pct: '', delay: '1.4s' },
  { cx: 52, cy: 34, r: 18, label: '', pct: '', delay: '0.4s' },
  { cx: 168, cy: 140, r: 14, label: '', pct: '', delay: '1s' }
]
</script>

<template>
  <div>
    <div class="relative" aria-hidden="true">
      <span
        class="pointer-events-none absolute -top-1 right-0 rounded-full border border-edge/10 bg-edge/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-ink-faint"
      >
        Sample
      </span>

      <svg viewBox="0 0 300 170" class="mx-auto mt-1 w-full max-w-xs">
        <g
          v-for="b in bubbles"
          :key="`${b.cx}-${b.cy}`"
          class="animate-float"
          :style="{ animationDelay: b.delay }"
        >
          <circle
            :cx="b.cx"
            :cy="b.cy"
            :r="b.r"
            style="fill: rgb(var(--accent) / 0.1); stroke: rgb(var(--accent) / 0.3)"
            stroke-width="1.5"
          />
          <text
            v-if="b.label"
            :x="b.cx"
            :y="b.pct ? b.cy - 4 : b.cy + 4"
            text-anchor="middle"
            class="text-[11px] font-medium"
            style="fill: rgb(var(--ink-faint))"
          >
            {{ b.label }}
          </text>
          <text
            v-if="b.pct"
            :x="b.cx"
            :y="b.cy + 14"
            text-anchor="middle"
            class="font-mono text-[11px] font-semibold"
            style="fill: rgb(var(--ink-faint))"
          >
            {{ b.pct }}
          </text>
        </g>
      </svg>
    </div>

    <div class="mt-4 text-center">
      <p class="font-medium text-ink">Nothing spent this month</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
        Your categories pack this space as bubbles — the bigger the bubble, the bigger
        its share of the month.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="emit('action')">
        Add an expense to see it
      </button>
    </div>
  </div>
</template>
