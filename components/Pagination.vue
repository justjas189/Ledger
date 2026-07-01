<script setup lang="ts">
// Previous / next pagination with a "showing X–Y of N" summary, styled like a
// ledger footer. Emits `update:page` so the parent can refetch that page.
const props = defineProps<{
  page: number
  totalPages: number
  total: number
  pageSize: number
}>()

const emit = defineEmits<{ 'update:page': [number] }>()

// The 1-based range of rows currently shown, e.g. "11–20 of 41".
const rangeStart = computed(() =>
  props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
)
const rangeEnd = computed(() => Math.min(props.page * props.pageSize, props.total))

const go = (p: number) => {
  const next = Math.min(Math.max(1, p), props.totalPages)
  if (next !== props.page) emit('update:page', next)
}
</script>

<template>
  <div
    class="flex flex-col items-center justify-between gap-3 border-t border-rule px-1 pt-4 text-sm sm:flex-row"
  >
    <p class="font-mono text-ink-soft tnum">
      {{ rangeStart }}–{{ rangeEnd }} of {{ total }}
    </p>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn btn-ghost px-3 py-1.5"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        ← Prev
      </button>
      <span class="px-1 font-mono text-ink-soft tnum">
        Page {{ page }} of {{ totalPages }}
      </span>
      <button
        type="button"
        class="btn btn-ghost px-3 py-1.5"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        Next →
      </button>
    </div>
  </div>
</template>
