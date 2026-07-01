<script setup lang="ts">
// A small coloured tag showing a category's icon + name.
// The colour comes from the database, so a category looks the same everywhere.
const props = withDefaults(
  defineProps<{
    name: string
    color: string
    icon?: string | null
    size?: 'sm' | 'md'
  }>(),
  { icon: null, size: 'md' }
)

// Build a faint tinted background from the category's hex colour (hex + alpha).
const tint = computed(() => ({
  backgroundColor: `${props.color}1A`, // ~10% opacity
  color: '#16231B'
}))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium leading-none"
    :class="size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'"
    :style="tint"
  >
    <span
      class="inline-block h-2 w-2 shrink-0 rounded-full"
      :style="{ backgroundColor: color }"
      aria-hidden="true"
    />
    <span v-if="icon" aria-hidden="true">{{ icon }}</span>
    <span>{{ name }}</span>
  </span>
</template>
