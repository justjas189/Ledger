<script setup lang="ts">
// Per-widget error isolation. Wraps one dashboard/analytics card's content in
// a <NuxtErrorBoundary>: a render or runtime error inside the slot shows this
// compact fallback instead of blanking the whole page. "Try again" clears the
// error and re-renders the slot.
import { TriangleAlert } from 'lucide-vue-next'

withDefaults(defineProps<{ label?: string }>(), { label: 'This widget' })
</script>

<template>
  <NuxtErrorBoundary>
    <slot />
    <template #error="{ clearError }">
      <div class="py-8 text-center">
        <TriangleAlert class="mx-auto h-5 w-5 text-negative" aria-hidden="true" />
        <p class="mt-2 text-sm font-medium text-ink">{{ label }} hit a snag.</p>
        <p class="mt-0.5 text-xs text-ink-soft">The rest of the page is unaffected.</p>
        <button type="button" class="btn btn-ghost mt-4" @click="clearError()">Try again</button>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>
