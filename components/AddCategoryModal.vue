<script setup lang="ts">
// Create-a-custom-category dialog. Name + a curated grid of muted colors —
// persists via the shared useCategories().addCategory, which patches the
// shared category list in place, so the dropdown, filter bar, and bubble
// chart all pick up the new category the instant this closes.
import { Loader2 } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { addCategory } = useCategories()
const toast = useToast()

// Mirrors the server's categoryName cap (server/utils/validation.ts) — kept
// in sync there so a name never arrives at the API only to bounce.
const NAME_MAX = 24

// Muted 600/700-step Tailwind hues — calmer than the vivid 500-step palette
// useCategoryColors() assigns automatically by name, and clear of emerald,
// the app's one reserved accent color (see tailwind.config.ts).
const SWATCHES = [
  { hex: '#475569', name: 'Slate' },
  { hex: '#57534E', name: 'Stone' },
  { hex: '#BE123C', name: 'Rose' },
  { hex: '#B45309', name: 'Amber' },
  { hex: '#0F766E', name: 'Teal' },
  { hex: '#0369A1', name: 'Sky' },
  { hex: '#6D28D9', name: 'Violet' },
  { hex: '#A21CAF', name: 'Fuchsia' }
] as const

const nameInput = ref('')
const colorInput = ref<string>(SWATCHES[0].hex)
const errors = ref<Record<string, string>>({})
const saving = ref(false)

// Reset every time the dialog opens so a cancelled draft never lingers.
watch(
  () => props.open,
  (open) => {
    if (!open) return
    nameInput.value = ''
    colorInput.value = SWATCHES[0].hex
    errors.value = {}
  }
)

function close() {
  if (saving.value) return
  emit('close')
}

async function submit() {
  if (saving.value) return
  const trimmed = nameInput.value.trim()
  if (!trimmed) {
    errors.value = { name: 'Give the category a name.' }
    return
  }
  if (trimmed.length > NAME_MAX) {
    errors.value = { name: `Keep the name under ${NAME_MAX} characters.` }
    return
  }

  errors.value = {}
  saving.value = true
  try {
    await addCategory({ name: trimmed, color: colorInput.value })
    toast.success(`"${trimmed}" added.`)
    emit('close')
  } catch (err: unknown) {
    const fieldErrors = (err as { data?: { data?: { fieldErrors?: Record<string, string> } } })?.data
      ?.data?.fieldErrors
    errors.value = fieldErrors ?? { name: 'Could not save. Please try again.' }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal :open="open" title="Add category" @close="close()">
    <form class="space-y-5" novalidate @submit.prevent="submit">
      <div>
        <div class="flex items-baseline justify-between">
          <label for="category-name" class="label">Name</label>
          <span
            class="text-xs tabular-nums"
            :class="nameInput.length >= NAME_MAX ? 'text-negative' : 'text-ink-faint'"
            aria-hidden="true"
          >
            {{ nameInput.length }}/{{ NAME_MAX }}
          </span>
        </div>
        <input
          id="category-name"
          v-model="nameInput"
          type="text"
          class="field"
          :class="{ 'field-invalid': errors.name }"
          placeholder="e.g. Subscriptions"
          :maxlength="NAME_MAX"
        />
        <p v-if="errors.name" class="mt-1 text-xs text-negative">{{ errors.name }}</p>
      </div>

      <div>
        <span class="label">Color</span>
        <div class="flex flex-wrap gap-3" role="radiogroup" aria-label="Category color">
          <button
            v-for="swatch in SWATCHES"
            :key="swatch.hex"
            type="button"
            role="radio"
            :aria-checked="colorInput === swatch.hex"
            :aria-label="swatch.name"
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform
              duration-150 hover:scale-105 motion-reduce:hover:scale-100"
            :style="{ backgroundColor: swatch.hex }"
            @click="colorInput = swatch.hex"
          >
            <span
              v-if="colorInput === swatch.hex"
              class="h-2.5 w-2.5 rounded-full bg-white shadow-sm"
              aria-hidden="true"
            />
          </button>
        </div>
        <p v-if="errors.color" class="mt-1 text-xs text-negative">{{ errors.color }}</p>
      </div>
    </form>

    <template #footer>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="close()">
        Cancel
      </button>
      <button type="button" class="btn btn-primary" :disabled="saving" @click="submit()">
        <Loader2
          v-if="saving"
          class="h-4 w-4 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <span>{{ saving ? 'Saving…' : 'Add category' }}</span>
      </button>
    </template>
  </Modal>
</template>
