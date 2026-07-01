<script setup lang="ts">
// A donut chart drawn by hand with SVG — no charting library needed.
//
// How it works: we draw one full circle per segment, then use `stroke-dasharray`
// to show only the slice of the ring that segment should occupy, and
// `stroke-dashoffset` to rotate each slice to start where the previous ended.
const props = withDefaults(
  defineProps<{
    segments: { label: string; color: string; value: number }[]
    size?: number
    thickness?: number
  }>(),
  { size: 184, thickness: 24 }
)

const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const center = computed(() => props.size / 2)

const total = computed(() =>
  props.segments.reduce((sum, s) => sum + (s.value > 0 ? s.value : 0), 0)
)

// Pre-compute the dash/offset geometry for each visible slice.
const arcs = computed(() => {
  const C = circumference.value
  let start = 0
  return props.segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const fraction = total.value > 0 ? s.value / total.value : 0
      const dash = fraction * C
      const arc = { color: s.color, dash, gap: C - dash, offset: -start }
      start += dash
      return arc
    })
})
</script>

<template>
  <div class="relative inline-grid place-items-center">
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      role="img"
      aria-label="Spending by category"
    >
      <!-- Rotate so the ring starts at the top (12 o'clock) instead of 3. -->
      <g :transform="`rotate(-90 ${center} ${center})`">
        <!-- Background track (also the whole ring when there's no data yet). -->
        <circle
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          stroke="#E8EEDF"
          :stroke-width="thickness"
        />
        <circle
          v-for="(a, i) in arcs"
          :key="i"
          :cx="center"
          :cy="center"
          :r="radius"
          fill="none"
          :stroke="a.color"
          :stroke-width="thickness"
          :stroke-dasharray="`${a.dash} ${a.gap}`"
          :stroke-dashoffset="a.offset"
          stroke-linecap="butt"
        />
      </g>
    </svg>

    <!-- Center label — the parent passes the formatted total in via the slot. -->
    <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
      <slot />
    </div>
  </div>
</template>
