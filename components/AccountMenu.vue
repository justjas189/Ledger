<script setup lang="ts">
// Account chip + dropdown (ROADMAP §1 "Account chip + auth polish"): lives in
// the floating header next to the month chip. Shows the signed-in email and
// avatar initial, quick theme + currency switches, an "Edit budget" jump, and
// sign out. Pure frontend — auth via the Supabase client, no API surface.
import { Check, LogOut, Moon, PencilLine, Sun } from 'lucide-vue-next'
import { CURRENCY_OPTIONS } from '~/composables/useCurrency'

const supabase = useSupabaseClient()
const user = useSupabaseUser()
const { isDark, toggle: toggleTheme } = useTheme()
const { active: currency, set: setCurrency } = useCurrency()
const { open: openBudgetModal } = useBudgetModal()

const menuOpen = ref(false)
const root = ref<HTMLElement | null>(null)
const triggerEl = ref<HTMLButtonElement | null>(null)
const signingOut = ref(false)

const email = computed(() => user.value?.email ?? '')
const initial = computed(() => (email.value[0] ?? '?').toUpperCase())

// Light-dismiss: click/tap anywhere outside closes; Escape closes and hands
// focus back to the trigger, matching the app's modal conventions.
function onDocPointerDown(e: PointerEvent) {
  if (menuOpen.value && root.value && !root.value.contains(e.target as Node)) {
    menuOpen.value = false
  }
}
function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && menuOpen.value) {
    menuOpen.value = false
    triggerEl.value?.focus()
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
  document.addEventListener('keydown', onDocKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
  document.removeEventListener('keydown', onDocKeydown)
})

// The budget editor instance lives on the dashboard, so land there first.
async function editBudget() {
  menuOpen.value = false
  await navigateTo('/')
  openBudgetModal()
}

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await supabase.auth.signOut()
    await navigateTo('/login')
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <div v-if="user" ref="root" class="pointer-events-auto relative">
    <button
      ref="triggerEl"
      type="button"
      class="glass flex items-center gap-2 rounded-full p-1.5 transition-colors duration-200 hover:border-black/15 sm:pr-3 dark:hover:border-white/20"
      aria-haspopup="menu"
      :aria-expanded="menuOpen"
      aria-label="Account menu"
      @click="menuOpen = !menuOpen"
    >
      <span
        class="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 font-mono text-[0.7rem] font-bold text-white"
        aria-hidden="true"
      >
        {{ initial }}
      </span>
      <span class="hidden max-w-[10rem] truncate font-mono text-xs text-ink-soft sm:block">
        {{ email }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="-translate-y-1 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="-translate-y-1 scale-95 opacity-0"
    >
      <div
        v-if="menuOpen"
        role="menu"
        aria-label="Account"
        class="glass-card absolute right-0 top-full z-50 mt-2 w-64 origin-top-right p-1.5 shadow-lg"
      >
        <!-- Who's signed in -->
        <div class="px-3 pb-2 pt-2.5">
          <p class="eyebrow">Signed in as</p>
          <p class="mt-0.5 truncate font-mono text-xs text-ink" :title="email">{{ email }}</p>
        </div>

        <div class="hairline my-1" />

        <!-- Theme shortcut -->
        <button type="button" role="menuitem" class="menu-item" @click="toggleTheme()">
          <component :is="isDark ? Sun : Moon" class="h-4 w-4" aria-hidden="true" />
          <span>{{ isDark ? 'Light mode' : 'Dark mode' }}</span>
        </button>

        <!-- Currency shortcut: one row of code chips, active one filled -->
        <div class="px-3 pb-1.5 pt-2">
          <p class="eyebrow mb-1.5">Currency</p>
          <div class="grid grid-cols-4 gap-1" role="group" aria-label="Display currency">
            <button
              v-for="o in CURRENCY_OPTIONS"
              :key="o.code"
              type="button"
              class="relative rounded-lg py-1.5 font-mono text-xs transition-colors duration-200"
              :class="
                currency === o.code
                  ? 'bg-emerald-600 text-white'
                  : 'bg-black/5 text-ink-soft hover:bg-black/10 hover:text-ink dark:bg-white/5 dark:hover:bg-white/10'
              "
              :aria-pressed="currency === o.code"
              :title="o.label"
              @click="setCurrency(o.code)"
            >
              {{ o.symbol }}
              <Check
                v-if="currency === o.code"
                class="absolute right-1 top-1 h-2.5 w-2.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </div>

        <!-- Edit budget -->
        <button type="button" role="menuitem" class="menu-item" @click="editBudget()">
          <PencilLine class="h-4 w-4" aria-hidden="true" />
          <span>Edit monthly budget</span>
        </button>

        <div class="hairline my-1" />

        <!-- Sign out -->
        <button
          type="button"
          role="menuitem"
          class="menu-item text-negative hover:!text-negative"
          :disabled="signingOut"
          @click="signOut()"
        >
          <LogOut class="h-4 w-4" aria-hidden="true" />
          <span>{{ signingOut ? 'Signing out…' : 'Sign out' }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.menu-item {
  @apply flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft
    transition-colors duration-200 hover:bg-black/5 hover:text-ink
    disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10;
}
</style>
