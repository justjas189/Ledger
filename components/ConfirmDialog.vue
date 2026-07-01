<script setup lang="ts">
// A small confirmation dialog built on top of <Modal>. Used before deleting an
// expense, so a destructive action is never a single misclick.
withDefaults(
  defineProps<{
    open: boolean
    title?: string
    message?: string
    confirmLabel?: string
    busy?: boolean
  }>(),
  {
    title: 'Are you sure?',
    message: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    busy: false
  }
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <Modal :open="open" :title="title" max-width="max-w-md" @close="emit('cancel')">
    <p class="text-sm leading-relaxed text-ink-soft">{{ message }}</p>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="busy" @click="emit('cancel')">
        Cancel
      </button>
      <button type="button" class="btn btn-danger" :disabled="busy" @click="emit('confirm')">
        {{ busy ? 'Deleting…' : confirmLabel }}
      </button>
    </template>
  </Modal>
</template>
