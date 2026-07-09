<script setup lang="ts">
// Where the money went — packed category bubbles.
// Each category is a bubble whose AREA is proportional to its spend, packed
// into a cluster and drifting gently. Every bubble wears its category's
// distinct hue (Transport blue, Groceries green, Dining orange … see
// useCategoryColors) so transaction types read at a glance, with fill opacity
// still scaled by share so magnitude is encoded twice (size + depth). Big
// bubbles carry their own labels; every bubble has a native tooltip; the
// legend below repeats identity in text + a colour dot.
//
// The packing is a deterministic greedy spiral: place the biggest bubble at
// the center, then walk each next bubble outward along a spiral until it
// finds the first spot where it touches nothing. No physics, no library, and
// the same data always packs the same way.
import type { CategoryBreakdown } from '~/types/expense'

const props = defineProps<{
  segments: CategoryBreakdown[]
}>()

const { formatMoney } = useFormatters()
const { categoryColor, withAlpha } = useCategoryColors()

interface Bubble {
  x: number
  y: number
  r: number
  seg: CategoryBreakdown
  share: number
  /** The category's resolved display hue. */
  hue: string
  /** Fill opacity, scaled to the bubble's weight. */
  fillAlpha: number
}

const packed = computed(() => {
  const items = props.segments.filter((s) => s.total > 0)
  if (!items.length) return { bubbles: [] as Bubble[], viewBox: '0 0 100 100' }

  const sorted = [...items].sort((a, b) => b.total - a.total)
  const grand = sorted.reduce((s, x) => s + x.total, 0)
  const maxV = sorted[0].total

  const bubbles: Bubble[] = []
  for (const seg of sorted) {
    // Area ∝ value: radius scales with sqrt, clamped so tiny slices stay visible.
    const r = 22 + 48 * Math.sqrt(seg.total / maxV)
    const share = (seg.total / grand) * 100
    const hue = categoryColor(seg.name, seg.color)
    // Depth ∝ value too: the heaviest category is the most saturated.
    const fillAlpha = 0.16 + 0.34 * (seg.total / maxV)

    if (!bubbles.length) {
      bubbles.push({ x: 0, y: 0, r, seg, share, hue, fillAlpha })
      continue
    }
    for (let step = 0; step < 4000; step++) {
      const t = step * 0.16
      const R = 4 + t * 2.1
      const x = R * Math.cos(t)
      const y = R * Math.sin(t) * 0.82 // slightly elliptical → wide cluster
      const clear = bubbles.every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + r + 5)
      if (clear) {
        bubbles.push({ x, y, r, seg, share, hue, fillAlpha })
        break
      }
    }
  }

  const pad = 10
  const minX = Math.min(...bubbles.map((b) => b.x - b.r)) - pad
  const minY = Math.min(...bubbles.map((b) => b.y - b.r)) - pad
  const maxX = Math.max(...bubbles.map((b) => b.x + b.r)) + pad
  const maxY = Math.max(...bubbles.map((b) => b.y + b.r)) + pad
  return {
    bubbles,
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
  }
})

// One-sentence summary for the SVG's aria-label; the sr-only table beside it
// carries the full numbers.
const bubbleSummary = computed(() => {
  const bs = packed.value.bubbles
  if (!bs.length) return 'Spending by category — no data yet'
  const top = bs[0]
  return `Bubble chart of spending across ${bs.length} ${bs.length === 1 ? 'category' : 'categories'}, sized by amount — largest is ${top.seg.name} at ${top.share.toFixed(0)}%. Full data in the table above.`
})
</script>

<template>
  <div>
    <!-- Non-visual fallback: the same data as a plain table. -->
    <table class="sr-only">
      <caption>Spending by category this month</caption>
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col">Amount</th>
          <th scope="col">Share</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in packed.bubbles" :key="b.seg.categoryId">
          <td>{{ b.seg.name }}</td>
          <td>{{ formatMoney(b.seg.total) }}</td>
          <td>{{ b.share.toFixed(0) }}%</td>
        </tr>
      </tbody>
    </table>

    <svg
      :viewBox="packed.viewBox"
      class="mx-auto block h-auto w-full max-w-md"
      role="img"
      :aria-label="bubbleSummary"
    >
      <g
        v-for="(b, i) in packed.bubbles"
        :key="b.seg.categoryId"
        class="float-wrap"
        :style="{ '--dur': `${5 + (i % 3) * 1.3}s`, '--del': `${i * 0.55}s` }"
      >
        <g
          class="bubble"
          :style="{ '--pd': `${120 + i * 90}ms` }"
        >
          <title>
            {{ b.seg.name }} — {{ formatMoney(b.seg.total) }} ({{ b.share.toFixed(0) }}%)
          </title>
          <circle
            class="bubble-body"
            :cx="b.x"
            :cy="b.y"
            :r="b.r"
            :style="{
              fill: withAlpha(b.hue, b.fillAlpha),
              stroke: withAlpha(b.hue, 0.55)
            }"
            stroke-width="1.5"
          />
          <!-- Direct labels on bubbles big enough to hold them -->
          <template v-if="b.r >= 42">
            <text
              :x="b.x"
              :y="b.y - b.r * 0.18"
              text-anchor="middle"
              class="fill-ink font-sans font-semibold"
              :style="{ fontSize: `${Math.min(16, b.r * 0.26)}px` }"
            >
              {{ b.seg.name }}
            </text>
            <text
              :x="b.x"
              :y="b.y + b.r * 0.14"
              text-anchor="middle"
              class="fill-ink font-mono tnum"
              :style="{ fontSize: `${Math.min(13, b.r * 0.2)}px` }"
            >
              {{ formatMoney(b.seg.total) }}
            </text>
            <text
              :x="b.x"
              :y="b.y + b.r * 0.42"
              text-anchor="middle"
              class="fill-ink-soft font-mono"
              :style="{ fontSize: `${Math.min(11, b.r * 0.17)}px` }"
            >
              {{ b.share.toFixed(0) }}%
            </text>
          </template>
          <text
            v-else-if="b.r >= 30"
            :x="b.x"
            :y="b.y + 3"
            text-anchor="middle"
            class="fill-ink font-sans font-medium"
            :style="{ fontSize: `${Math.min(11, b.r * 0.3)}px` }"
          >
            {{ b.share.toFixed(0) }}%
          </text>
        </g>
      </g>
    </svg>

    <!-- Legend: identity in text + colour dot, so hue is reinforced, not required. -->
    <ul class="mt-4 flex flex-wrap justify-center gap-2">
      <li
        v-for="b in packed.bubbles"
        :key="b.seg.categoryId"
        class="flex items-center gap-1.5 rounded-full border border-edge/10 bg-edge/5 px-2.5 py-1 text-xs"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{ backgroundColor: b.hue }"
          aria-hidden="true"
        />
        <span class="font-medium text-ink-soft">{{ b.seg.name }}</span>
        <span class="font-mono text-ink-faint tnum">{{ formatMoney(b.seg.total) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The gentle drift. Outer group floats, inner group pops in — separate
   elements so the two transforms never fight. */
.float-wrap {
  animation: bubble-float var(--dur) ease-in-out var(--del) infinite;
}
.bubble {
  transform-box: fill-box;
  transform-origin: center;
  animation: bubble-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: var(--pd);
}
.bubble-body {
  transition: filter 0.25s ease;
}
.bubble:hover .bubble-body {
  filter: brightness(1.15);
}

@keyframes bubble-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-5px);
  }
}
@keyframes bubble-in {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
