<script setup lang="ts">
// A compact figure card: small label on top, a big monospaced value, and an
// optional line of supporting text. Used for the dashboard's headline numbers.
withDefaults(
  defineProps<{
    label: string
    value: string
    sub?: string
    /** Colour accent for the little tick on the left edge. */
    accent?: string
  }>(),
  { sub: '', accent: '#1E5A48' }
)
</script>

<template>
  <div class="card relative overflow-hidden p-4 sm:p-5">
    <!-- A thin coloured tick — a quiet nod to a ledger's ruled margin. -->
    <span
      class="absolute inset-y-0 left-0 w-1"
      :style="{ backgroundColor: accent }"
      aria-hidden="true"
    />
    <p class="eyebrow">{{ label }}</p>
    <p class="mt-2 font-mono text-2xl font-semibold tracking-tight text-ink tnum">
      {{ value }}
    </p>
    <p v-if="sub" class="mt-1 text-sm text-ink-soft">{{ sub }}</p>
  </div>
</template>
