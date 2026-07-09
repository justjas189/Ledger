<script setup lang="ts">
// Shape-matched chart placeholders, one variant per widget geometry:
//   rings    — the budget rings row (circles + label bars)
//   bubbles  — the packed category bubbles (staggered circle sizes)
//   bars     — the daily bar chart (columns of fixed varied heights)
//   calendar — the month grid (7 columns of day cells)
//   list     — entry rows (two text lines + an amount)
//   line     — a single tall block (trend/compare charts)
//
// Heights and sizes are FIXED arrays, not Math.random(): these render during
// SSR (lazy fetches start pending), so server and client markup must match.
withDefaults(
  defineProps<{
    variant?: 'rings' | 'bubbles' | 'bars' | 'calendar' | 'list' | 'line'
  }>(),
  { variant: 'line' }
)

const BAR_HEIGHTS = [45, 70, 30, 85, 55, 95, 40, 65, 75, 35, 60, 50]
const BUBBLE_SIZES = [96, 72, 56, 44, 36]
const LIST_WIDTHS = ['w-40', 'w-28', 'w-36', 'w-24', 'w-32']
</script>

<template>
  <div aria-hidden="true">
    <!-- Budget rings: a row of circles with a short label bar under each. -->
    <div v-if="variant === 'rings'" class="flex flex-wrap items-start justify-center gap-8 py-4">
      <div v-for="n in 4" :key="n" class="flex flex-col items-center gap-3" :style="{ '--stagger': n - 1 }">
        <div class="skeleton h-24 w-24 rounded-full" />
        <div class="skeleton h-3 w-16" />
      </div>
    </div>

    <!-- Packed bubbles: descending circle sizes, loosely clustered. -->
    <div v-else-if="variant === 'bubbles'" class="flex h-48 flex-wrap items-center justify-center gap-4">
      <div
        v-for="(size, i) in BUBBLE_SIZES"
        :key="i"
        class="skeleton rounded-full"
        :style="{ width: `${size}px`, height: `${size}px`, '--stagger': i }"
      />
    </div>

    <!-- Daily bars: columns rising from the baseline. -->
    <div v-else-if="variant === 'bars'" class="flex h-64 items-end gap-2">
      <div
        v-for="(h, i) in BAR_HEIGHTS"
        :key="i"
        class="skeleton flex-1 rounded-t-lg rounded-b-none"
        :style="{ height: `${h}%`, '--stagger': i }"
      />
    </div>

    <!-- Calendar: weekday header bar + a 7-column month grid. -->
    <div v-else-if="variant === 'calendar'">
      <div class="skeleton h-4 w-full" />
      <div class="mt-2 grid grid-cols-7 gap-1.5">
        <div
          v-for="n in 35"
          :key="n"
          class="skeleton aspect-square rounded-lg"
          :style="{ '--stagger': (n - 1) % 7 }"
        />
      </div>
    </div>

    <!-- Entry rows: description + meta line on the left, amount on the right. -->
    <div v-else-if="variant === 'list'" class="divide-y divide-edge/5">
      <div
        v-for="(w, i) in LIST_WIDTHS"
        :key="i"
        class="flex items-center justify-between gap-3 px-2 py-3.5"
        :style="{ '--stagger': i }"
      >
        <div class="min-w-0 flex-1">
          <div class="skeleton h-4" :class="w" />
          <div class="mt-2 flex items-center gap-2">
            <div class="skeleton h-3 w-16 rounded-full" />
            <div class="skeleton h-3 w-12" />
          </div>
        </div>
        <div class="skeleton h-4 w-20" />
      </div>
    </div>

    <!-- Fallback: one tall block for line/area charts. -->
    <div v-else class="skeleton h-56 w-full rounded-2xl" />
  </div>
</template>
