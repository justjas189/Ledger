<script setup lang="ts">
// Vaulted's navigation: a floating frosted dock, centered at the bottom of
// the viewport — no header, no sidebar. The two main destinations (Dashboard,
// Analytics) flank a raised accent "+" button that opens the add-expense
// drawer from anywhere. Past the divider sit the secondary controls: an
// icon-only Expenses link and the sun/moon theme toggle.
import { BarChart3, LayoutDashboard, Moon, Plus, ReceiptText, Sun } from 'lucide-vue-next'

const route = useRoute()
const { open: openQuickAdd } = useQuickAdd()
const { isDark, toggle: toggleTheme } = useTheme()

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 }
]

// A link is active when the current path matches (exact for the dashboard,
// prefix for sections like /expenses/...).
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to)
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6"
    aria-label="Primary"
  >
    <div class="glass grid grid-cols-[1fr_auto_1fr] items-center rounded-full p-1.5 shadow-sm">
      
      <div class="flex items-center justify-end gap-1">
        
        <button
          type="button"
          class="dock-item dock-item-idle !px-3"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          @click="toggleTheme()"
        >
          <ClientOnly>
            <component :is="isDark ? Sun : Moon" class="h-4 w-4" aria-hidden="true" />
            <template #fallback>
              <span class="block h-4 w-4" aria-hidden="true" />
            </template>
          </ClientOnly>
        </button>

        <span class="mx-0.5 h-6 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />

        <NuxtLink
          :to="links[0].to"
          class="dock-item"
          :class="isActive(links[0].to) ? 'dock-item-active' : 'dock-item-idle'"
          :aria-current="isActive(links[0].to) ? 'page' : undefined"
        >
          <component :is="links[0].icon" class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ links[0].label }}</span>
        </NuxtLink>
      </div>

      <button
        type="button"
        class="group mx-1 grid h-12 w-12 -translate-y-3 place-items-center rounded-full bg-emerald-600 text-white shadow-md transition-all duration-300 hover:-translate-y-4 hover:bg-emerald-500 active:scale-95"
        aria-label="Add expense"
        @click="openQuickAdd()"
      >
        <Plus
          class="h-5 w-5 transition-transform duration-300 group-hover:rotate-90"
          aria-hidden="true"
        />
      </button>

      <div class="flex items-center justify-start gap-1">
        <NuxtLink
          :to="links[1].to"
          class="dock-item"
          :class="isActive(links[1].to) ? 'dock-item-active' : 'dock-item-idle'"
          :aria-current="isActive(links[1].to) ? 'page' : undefined"
        >
          <component :is="links[1].icon" class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">{{ links[1].label }}</span>
        </NuxtLink>

        <span class="mx-0.5 h-6 w-px bg-black/10 dark:bg-white/10" aria-hidden="true" />

        <NuxtLink
          to="/expenses"
          class="dock-item !px-3"
          :class="isActive('/expenses') ? 'dock-item-active' : 'dock-item-idle'"
          :aria-current="isActive('/expenses') ? 'page' : undefined"
          aria-label="Expenses"
          title="Expenses"
        >
          <ReceiptText class="h-4 w-4" aria-hidden="true" />
        </NuxtLink>
      </div>
      
    </div>
  </nav>
</template>

<style scoped>
.dock-item {
  @apply inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium
    transition-colors duration-200;
}
.dock-item-idle {
  @apply text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10;
}
.dock-item-active {
  @apply bg-black/5 text-ink dark:bg-white/10;
}
</style>
