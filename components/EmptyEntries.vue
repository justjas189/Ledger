<script setup lang="ts">
// Illustrated empty state for the recent-entries card. Three ghost rows echo
// the real list's anatomy (description, category pill, date, amount) so the
// card explains itself before the first expense exists. Rows are static
// placeholder shapes — not skeletons — because nothing is loading.
// Decorative (aria-hidden); the copy + CTA underneath carry the message.
const emit = defineEmits<{ action: [] }>()

// Varied widths so the ghost list reads as content, not a repeated pattern.
const rows = [
  { desc: 'w-32', pill: 'w-16', amount: 'w-16' },
  { desc: 'w-24', pill: 'w-20', amount: 'w-12' },
  { desc: 'w-40', pill: 'w-14', amount: 'w-14' }
]
</script>

<template>
  <div>
    <div class="relative" aria-hidden="true">
      <span
        class="pointer-events-none absolute right-0 top-1 rounded-full border border-edge/10 bg-edge/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-ink-faint"
      >
        Sample
      </span>

      <ul class="divide-y divide-edge/5 pt-1">
        <li
          v-for="(r, i) in rows"
          :key="i"
          class="flex items-center justify-between gap-3 px-2 py-3"
          :style="{ opacity: 1 - i * 0.25 }"
        >
          <div class="min-w-0">
            <div class="h-3.5 rounded bg-edge/10" :class="r.desc" />
            <div class="mt-2 flex items-center gap-2">
              <div class="h-4 rounded-full bg-positive/15" :class="r.pill" />
              <div class="h-3 w-12 rounded bg-edge/10" />
            </div>
          </div>
          <div class="h-4 rounded bg-edge/10" :class="r.amount" />
        </li>
      </ul>
    </div>

    <div class="pb-2 pt-4 text-center">
      <p class="font-medium text-ink">No entries yet</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
        Every expense you log lands here, newest first — press
        <kbd
          class="rounded-md border border-black/10 bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:border-white/15 dark:bg-white/5"
        >N</kbd>
        anywhere to add one.
      </p>
      <button type="button" class="btn btn-primary mt-4" @click="emit('action')">
        Add your first expense
      </button>
    </div>
  </div>
</template>
