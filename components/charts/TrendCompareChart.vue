<script setup lang="ts">
// Month vs month — this month's cumulative spending trajectory (a smooth
// accent line) against last month's average pace (a dashed neutral ramp:
// last month's total spread evenly across the days of the month).
// If the solid line rides above the dashed one, this month is outspending
// last month's rhythm — the chip above the chart says so in words too.
//
// When a `forecast` is supplied (see useForecast), the trajectory continues
// past today as a dashed ACCENT line: each remaining day's expected spend
// (weekday rhythm + recurring monthly spikes) stacked cumulatively to a
// month-end estimate.
import type { DailyTrendPoint } from '~/types/expense'
import type { ForecastDay } from '~/composables/useForecast'

const props = defineProps<{
  /** The 30-day daily trend from /api/stats (oldest first, zero-filled). */
  points: DailyTrendPoint[]
  lastMonthTotal: number
  /** Expected spend for each remaining day of this month (optional). */
  forecast?: ForecastDay[]
}>()

const { formatMoney, formatMoneyCompact } = useFormatters()

// --- Chart geometry ----------------------------------------------------------
const W = 600
const H = 240
const PAD = { top: 16, right: 16, bottom: 24, left: 48 }
const plotW = W - PAD.left - PAD.right
const plotH = H - PAD.top - PAD.bottom

const now = new Date()
const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
const dayOfMonth = now.getDate()
const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

// Cumulative spend for each elapsed day of the current month.
const cumulative = computed<number[]>(() => {
  const byDay = new Map(
    props.points.filter((p) => p.date.startsWith(monthKey)).map((p) => [Number(p.date.slice(-2)), p.total])
  )
  const out: number[] = []
  let running = 0
  for (let d = 1; d <= dayOfMonth; d++) {
    running += byDay.get(d) ?? 0
    out.push(running)
  }
  return out
})

// Last month's average pace, as a cumulative ramp over this month's days.
const refAtDay = (d: number) => (props.lastMonthTotal / daysInMonth) * d

// The forecast continuation, stacked cumulatively on top of today's total.
const forecastCumulative = computed<{ day: number; value: number }[]>(() => {
  if (!props.forecast?.length || !cumulative.value.length) return []
  let running = cumulative.value[cumulative.value.length - 1]
  return props.forecast.map((f) => {
    running += f.expected
    return { day: f.day, value: running }
  })
})
const forecastEnd = computed(() =>
  forecastCumulative.value.length
    ? forecastCumulative.value[forecastCumulative.value.length - 1].value
    : 0
)

const yMax = computed(() => {
  const top = Math.max(
    cumulative.value[cumulative.value.length - 1] ?? 0,
    forecastEnd.value,
    props.lastMonthTotal,
    1
  )
  return top * 1.08 // headroom so the highest point never kisses the frame
})

const x = (day: number) => PAD.left + ((day - 1) / (daysInMonth - 1)) * plotW
const y = (v: number) => PAD.top + plotH - (v / yMax.value) * plotH

// Smooth the cumulative line with cubic segments (control points at ⅓ between
// neighbours — a light Catmull-Rom-style pass, enough to soften the corners
// of a monotone series without overshooting it).
const trendPath = computed(() => {
  const pts = cumulative.value.map((v, i) => ({ px: x(i + 1), py: y(v) }))
  if (!pts.length) return ''
  if (pts.length === 1) return `M ${pts[0].px} ${pts[0].py}`
  let d = `M ${pts[0].px} ${pts[0].py}`
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]
    const p1 = pts[i]
    const dx = (p1.px - p0.px) / 3
    d += ` C ${p0.px + dx} ${p0.py}, ${p1.px - dx} ${p1.py}, ${p1.px} ${p1.py}`
  }
  return d
})

// Same line closed down to the baseline, for the soft area fill beneath it.
const areaPath = computed(() => {
  if (!trendPath.value || cumulative.value.length < 2) return ''
  const lastX = x(cumulative.value.length)
  const baseY = PAD.top + plotH
  return `${trendPath.value} L ${lastX} ${baseY} L ${x(1)} ${baseY} Z`
})

const refPath = computed(
  () => `M ${x(1)} ${y(refAtDay(1))} L ${x(daysInMonth)} ${y(refAtDay(daysInMonth))}`
)

const endPoint = computed(() => {
  const last = cumulative.value.length
  if (!last) return null
  return { px: x(last), py: y(cumulative.value[last - 1]) }
})

// The forecast path picks up exactly where the solid line ends. Straight
// dashed segments on purpose — it's an estimate, and the texture should
// read differently from the measured curve.
const forecastPath = computed(() => {
  if (!forecastCumulative.value.length || !endPoint.value) return ''
  let d = `M ${endPoint.value.px} ${endPoint.value.py}`
  for (const p of forecastCumulative.value) d += ` L ${x(p.day)} ${y(p.value)}`
  return d
})

const forecastEndPoint = computed(() => {
  const last = forecastCumulative.value[forecastCumulative.value.length - 1]
  if (!last) return null
  return { px: x(last.day), py: y(last.value) }
})

// Horizontal gridlines at 0 / ⅓ / ⅔ / max.
const gridlines = computed(() =>
  [0, 1 / 3, 2 / 3, 1].map((f) => ({ value: yMax.value * f, py: y(yMax.value * f) }))
)

// Sparse day labels along the x-axis.
const dayTicks = computed(() => {
  const ticks = [1, 8, 15, 22, daysInMonth]
  return [...new Set(ticks)].map((d) => ({ d, px: x(d) }))
})

// "So what": ahead of or behind last month's pace, at today's mark.
const paceDelta = computed(() => {
  const spent = cumulative.value[cumulative.value.length - 1] ?? 0
  return spent - refAtDay(dayOfMonth)
})

// The chart's message in one sentence, with the real numbers — this is what
// a screen reader gets instead of the SVG geometry.
const chartSummary = computed(() => {
  const spent = cumulative.value[cumulative.value.length - 1] ?? 0
  let summary = `Line chart: ${formatMoney(spent)} spent through day ${dayOfMonth} of ${daysInMonth} this month.`
  if (props.lastMonthTotal > 0) {
    summary += ` That is ${formatMoney(Math.abs(paceDelta.value))} ${
      paceDelta.value > 0 ? 'above' : 'below'
    } last month's average pace toward its ${formatMoney(props.lastMonthTotal)} total.`
  }
  if (forecastPath.value) {
    summary += ` The seasonal forecast projects roughly ${formatMoney(forecastEnd.value)} by month end.`
  }
  return summary
})
</script>

<template>
  <div>
    <!-- Legend + pace verdict -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-4 font-mono text-[0.65rem] text-ink-soft">
        <span class="flex items-center gap-1.5">
          <span class="h-0.5 w-5 rounded-full bg-accent" aria-hidden="true" />
          This month
        </span>
        <span class="flex items-center gap-1.5">
          <svg width="20" height="2" aria-hidden="true" class="overflow-visible">
            <line x1="0" y1="1" x2="20" y2="1" stroke="rgb(var(--ink-faint))" stroke-width="2" stroke-dasharray="4 3" />
          </svg>
          Last month avg
        </span>
        <span v-if="forecastPath" class="flex items-center gap-1.5">
          <svg width="20" height="2" aria-hidden="true" class="overflow-visible">
            <line x1="0" y1="1" x2="20" y2="1" stroke="rgb(var(--accent))" stroke-width="2" stroke-dasharray="3 4" />
          </svg>
          Forecast
        </span>
      </div>
      <p
        v-if="lastMonthTotal > 0"
        class="rounded-full border px-2.5 py-1 font-mono text-xs font-medium tnum"
        :class="
          paceDelta > 0
            ? 'border-negative/30 bg-negative/10 text-negative'
            : 'border-positive/30 bg-positive/10 text-positive'
        "
      >
        {{ formatMoney(Math.abs(paceDelta)) }}
        {{ paceDelta > 0 ? 'above' : 'below' }} last month's pace
      </p>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="mt-3 block h-auto w-full"
      role="img"
      :aria-label="chartSummary"
    >
      <!-- Gridlines + y labels -->
      <g v-for="g in gridlines" :key="g.py">
        <line
          :x1="PAD.left"
          :y1="g.py"
          :x2="W - PAD.right"
          :y2="g.py"
          stroke="rgb(var(--edge) / 0.08)"
          stroke-width="1"
        />
        <text
          :x="PAD.left - 8"
          :y="g.py + 3"
          text-anchor="end"
          class="fill-ink-faint font-mono"
          style="font-size: 10px"
        >
          {{ formatMoneyCompact(g.value) }}
        </text>
      </g>

      <!-- X-axis day ticks -->
      <text
        v-for="t in dayTicks"
        :key="t.d"
        :x="t.px"
        :y="H - 6"
        text-anchor="middle"
        class="fill-ink-faint font-mono"
        style="font-size: 10px"
      >
        {{ t.d }}
      </text>

      <!-- Last month's average pace: dashed neutral ramp -->
      <path
        :d="refPath"
        fill="none"
        stroke="rgb(var(--ink-faint) / 0.8)"
        stroke-width="1.5"
        stroke-dasharray="5 4"
      />

      <!-- This month: soft area + smooth accent line -->
      <path v-if="areaPath" :d="areaPath" fill="rgb(var(--accent) / 0.1)" />
      <path
        v-if="trendPath"
        :d="trendPath"
        fill="none"
        stroke="rgb(var(--accent-strong))"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="trend-line"
      />

      <!-- Forecast continuation: dashed accent line to a month-end estimate -->
      <path
        v-if="forecastPath"
        :d="forecastPath"
        fill="none"
        stroke="rgb(var(--accent) / 0.75)"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray="3 5"
      />
      <!-- Month-end estimate marker: hollow, because it's a projection -->
      <circle
        v-if="forecastEndPoint"
        :cx="forecastEndPoint.px"
        :cy="forecastEndPoint.py"
        r="3.5"
        fill="none"
        stroke="rgb(var(--accent-strong))"
        stroke-width="1.5"
      />

      <!-- Today's endpoint -->
      <g v-if="endPoint">
        <circle :cx="endPoint.px" :cy="endPoint.py" r="7" fill="rgb(var(--accent) / 0.2)" />
        <circle :cx="endPoint.px" :cy="endPoint.py" r="3.5" fill="rgb(var(--accent-strong))" />
      </g>
    </svg>

    <p class="mt-2 text-xs text-ink-faint">
      Cumulative spend, day 1 → {{ daysInMonth }}. Dashed gray = last month's total
      ({{ formatMoney(lastMonthTotal) }}) at an even daily pace.
      <template v-if="forecastPath">
        Dashed green = seasonal forecast (weekday rhythm + recurring bills) landing near
        {{ formatMoney(forecastEnd) }}.
      </template>
    </p>
  </div>
</template>

<style scoped>
/* The line draws itself in on load — long dash offset swept to zero. */
.trend-line {
  stroke-dasharray: 1600;
  stroke-dashoffset: 1600;
  animation: draw-line 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.15s forwards;
}
@keyframes draw-line {
  to {
    stroke-dashoffset: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .trend-line {
    stroke-dasharray: none;
    stroke-dashoffset: 0;
    animation: none;
  }
}
</style>
