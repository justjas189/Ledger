<script setup lang="ts">
// A metric tile: small label + icon on top, a big monospaced value, and an
// optional delta chip (trend direction + tone) with supporting text.
// Used for the dashboard's headline numbers.
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
     * How the delta should read: 'positive' = emerald (good), 'negative' =
     * rose (bad), 'neutral' = gray. Direction of the arrow is independent —
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
  positive: 'border-positive/30 bg-positive/10 text-positive',
  negative: 'border-negative/30 bg-negative/10 text-negative',
  neutral: 'border-edge/10 bg-edge/5 text-ink-soft'
}
</script>

<template>
  <div class="glass-card group p-5">
    <div class="flex items-center justify-between gap-2">
      <p class="eyebrow">{{ label }}</p>
      <span
        class="grid h-8 w-8 place-items-center rounded-lg border border-edge/10 bg-edge/5 text-ink-soft transition-colors duration-300 group-hover:text-ink"
      >
        <component :is="icon" v-if="icon" class="h-4 w-4" aria-hidden="true" />
      </span>
    </div>

    <p class="mt-3 font-mono text-2xl font-semibold tracking-tight text-ink tnum">
      {{ value }}
    </p>

    <div class="mt-2 flex items-center gap-2">
      <span
        v-if="delta"
        class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-medium tnum"
        :class="toneClasses[deltaTone]"
      >
        <component :is="deltaIcon" class="h-3 w-3" aria-hidden="true" />
        {{ delta }}
      </span>
      <!-- The sub slot lets a caller enrich the supporting line (e.g. the
           balance tile's inline budget-edit affordance). -->
      <slot name="sub">
        <span v-if="sub" class="text-sm text-ink-faint">{{ sub }}</span>
      </slot>
    </div>
  </div>
</template>
