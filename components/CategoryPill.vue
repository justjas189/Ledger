<script setup lang="ts">
// A small coloured tag showing a category's icon + name.
// The colour comes from the database, so a category looks the same everywhere.
// `icon` is a Lucide icon name (e.g. "shopping-cart") resolved to a component;
// unknown names simply render without an icon.
const props = withDefaults(
  defineProps<{
    name: string
    color: string
    icon?: string | null
    size?: 'sm' | 'md'
  }>(),
  { icon: null, size: 'md' }
)

const { resolveIcon } = useCategoryIcons()
const iconComponent = computed(() => resolveIcon(props.icon))

// Build a faint tinted background from the category's hex colour (hex + alpha).
const tint = computed(() => ({
  backgroundColor: `${props.color}14`, // ~8% opacity
  color: '#0F172A'
}))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-medium leading-none"
    :class="size === 'sm' ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'"
    :style="tint"
  >
    <component
      :is="iconComponent"
      v-if="iconComponent"
      class="h-3.5 w-3.5 shrink-0"
      :style="{ color }"
      aria-hidden="true"
    />
    <span
      v-else
      class="inline-block h-2 w-2 shrink-0 rounded-full"
      :style="{ backgroundColor: color }"
      aria-hidden="true"
    />
    <span>{{ name }}</span>
  </span>
</template>
