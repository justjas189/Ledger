<script setup lang="ts">
// Geometry-matched placeholder for <StatCard>: same card, padding, and
// element sizes, so nothing shifts when the real numbers land. `stagger`
// offsets the shimmer sweep in 50ms steps (see .skeleton in main.css).
withDefaults(defineProps<{ stagger?: number }>(), { stagger: 0 })
</script>

<template>
  <div class="glass-card p-5" aria-hidden="true" :style="{ '--stagger': stagger }">
    <div class="flex items-center justify-between gap-2">
      <div class="skeleton h-3 w-24" />
      <div class="skeleton h-8 w-8 rounded-lg" />
    </div>
    <div class="skeleton mt-3 h-8 w-36" />
    <div class="skeleton mt-2 h-4 w-44" />
  </div>
</template>
