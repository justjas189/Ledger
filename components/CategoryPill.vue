<script setup lang="ts">
// A category tag with a coloured circular icon wrapper — the modern banking
// app pattern. Each category resolves to its distinct hue (Transport blue,
// Groceries green, Dining orange … see useCategoryColors), the icon sits in a
// soft tinted circle of that hue, and the name stays in plain text so
// identity never depends on colour alone.
// `icon` is a Lucide icon name (e.g. "shopping-cart") resolved to a component;
// unknown names fall back to a coloured dot.
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
const { categoryColor, withAlpha } = useCategoryColors()

const iconComponent = computed(() => resolveIcon(props.icon))
const hue = computed(() => categoryColor(props.name, props.color))
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 font-medium leading-none text-ink-soft"
    :class="size === 'sm' ? 'text-xs' : 'text-sm'"
  >
    <span
      class="grid shrink-0 place-items-center rounded-full"
      :class="size === 'sm' ? 'h-5 w-5' : 'h-6 w-6'"
      :style="{ backgroundColor: withAlpha(hue, 0.16) }"
      aria-hidden="true"
    >
      <component
        :is="iconComponent"
        v-if="iconComponent"
        :class="size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'"
        :style="{ color: hue }"
      />
      <span
        v-else
        class="inline-block h-1.5 w-1.5 rounded-full"
        :style="{ backgroundColor: hue }"
      />
    </span>
    <span>{{ name }}</span>
  </span>
</template>
