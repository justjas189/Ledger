<script setup lang="ts">
// This month's spending vs the configured budget, per category.
// Two grouped bars per category: a light "budget" bar as the yardstick, and a
// "spent" bar that turns crimson the moment a category goes over.
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
  type ChartData,
  type ChartOptions
} from 'chart.js'
import { Bar } from 'vue-chartjs'
import type { BudgetComparison } from '~/types/expense'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  budgets: BudgetComparison[]
  currency: string
}>()

const { formatMoney } = useFormatters()

const data = computed<ChartData<'bar'>>(() => ({
  labels: props.budgets.map((b) => b.name),
  datasets: [
    {
      label: 'Spent',
      data: props.budgets.map((b) => b.spent),
      // Teal while under budget, crimson once over — the chart itself reads
      // as a status report, no legend-squinting required.
      backgroundColor: props.budgets.map((b) =>
        b.spent > b.budget ? '#9F1239' : '#0F766E'
      ),
      borderRadius: 4,
      maxBarThickness: 22
    },
    {
      label: 'Budget',
      data: props.budgets.map((b) => b.budget),
      backgroundColor: '#E2E8F0', // edge
      borderRadius: 4,
      maxBarThickness: 22
    }
  ]
}))

const options = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      align: 'end',
      labels: {
        color: '#64748B', // ink-soft
        font: { family: 'Inter', size: 11 },
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: 'rectRounded'
      }
    },
    tooltip: {
      backgroundColor: '#0F172A',
      titleFont: { family: 'Inter' },
      bodyFont: { family: 'IBM Plex Mono' },
      padding: 10,
      callbacks: {
        label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y ?? 0, props.currency)}`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      border: { color: '#E2E8F0' },
      ticks: { color: '#64748B', font: { family: 'Inter', size: 11 } }
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
    <Bar :data="data" :options="options" aria-label="Spending versus budget by category" />
  </div>
</template>
