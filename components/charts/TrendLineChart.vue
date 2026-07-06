<script setup lang="ts">
// Spending over the last 30 days, as a Chart.js line with a soft area fill.
// Only the pieces this chart needs are registered, so tree-shaking keeps the
// rest of Chart.js out of the bundle.
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import { Line } from 'vue-chartjs'
import type { DailyTrendPoint } from '~/types/expense'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

const props = defineProps<{
  points: DailyTrendPoint[]
  currency: string
}>()

const { formatMoney } = useFormatters()

// "2026-07-03" -> "3 Jul", parsed as local time (appending T00:00 avoids the
// UTC shift you'd get from new Date('YYYY-MM-DD')).
const shortDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T00:00:00`)
  )

const data = computed<ChartData<'line'>>(() => ({
  labels: props.points.map((p) => shortDay(p.date)),
  datasets: [
    {
      data: props.points.map((p) => p.total),
      borderColor: '#0F172A', // ink
      backgroundColor: 'rgba(15, 23, 42, 0.05)',
      borderWidth: 2,
      fill: true,
      tension: 0.35,
      pointRadius: 0,
      pointHitRadius: 12,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: '#0F172A'
    }
  ]
}))

const options = computed<ChartOptions<'line'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    tooltip: {
      backgroundColor: '#0F172A',
      titleFont: { family: 'Inter' },
      bodyFont: { family: 'IBM Plex Mono' },
      padding: 10,
      displayColors: false,
      callbacks: {
        label: (ctx) => formatMoney(ctx.parsed.y ?? 0, props.currency)
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: '#E2E8F0' }, // edge
      ticks: {
        color: '#64748B', // ink-soft
        font: { family: 'IBM Plex Mono', size: 10 },
        maxTicksLimit: 6,
        maxRotation: 0
      }
    },
    y: {
      beginAtZero: true,
      grid: { color: '#F1F5F9' }, // subtle
      border: { display: false },
      ticks: {
        color: '#64748B',
        font: { family: 'IBM Plex Mono', size: 10 },
        maxTicksLimit: 5,
        callback: (value) => formatMoney(Number(value), props.currency).replace(/\.00$/, '')
      }
    }
  }
}))
</script>

<template>
  <div class="h-56 sm:h-64">
    <Line :data="data" :options="options" aria-label="Spending over the last 30 days" />
  </div>
</template>
