<script setup lang="ts">
// A professional metric card: small label + icon on top, a big monospaced
// value, and an optional delta chip (trend direction + tone) with supporting
// text. Used for the dashboard's headline numbers.
import { Minus, TrendingDown, TrendingUp } from 'lucide-vue-next'
import type { Component } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string
    sub?: string
    /** Lucide icon component shown next to the label. */
    icon?: Component | null
    /** Formatted delta, e.g. "+12.3%". Omit to hide the chip. */
    delta?: string | null
    /**
     * How the delta should read: 'positive' = teal (good), 'negative' =
     * crimson (bad), 'neutral' = gray. Direction of the arrow is independent —
     * for spending, an INCREASE is bad, so the caller decides the tone.
     */
    deltaTone?: 'positive' | 'negative' | 'neutral'
    /** Arrow direction on the delta chip. */
    deltaDirection?: 'up' | 'down' | 'flat'
  }>(),
  { sub: '', icon: null, delta: null, deltaTone: 'neutral', deltaDirection: 'flat' }
)

const deltaIcon = computed(() =>
  props.deltaDirection === 'up' ? TrendingUp : props.deltaDirection === 'down' ? TrendingDown : Minus
)

const toneClasses: Record<string, string> = {
  positive: 'bg-positive-soft text-positive-dark',
  negative: 'bg-negative-soft text-negative-dark',
  neutral: 'bg-subtle text-ink-soft'
}
</script>

<template>
  <div class="card p-4 sm:p-5">
    <div class="flex items-center justify-between gap-2">
      <p class="eyebrow">{{ label }}</p>
      <component
        :is="icon"
        v-if="icon"
        class="h-4 w-4 shrink-0 text-ink-soft"
        aria-hidden="true"
      />
    </div>

    <p class="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink tnum">
      {{ value }}
    </p>

    <div class="mt-1.5 flex items-center gap-2">
      <span
        v-if="delta"
        class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-mono text-xs font-medium tnum"
        :class="toneClasses[deltaTone]"
      >
        <component :is="deltaIcon" class="h-3 w-3" aria-hidden="true" />
        {{ delta }}
      </span>
      <span v-if="sub" class="text-sm text-ink-soft">{{ sub }}</span>
    </div>
  </div>
</template>
