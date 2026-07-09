// Light/dark theme state, shared app-wide.
// The theme is a `.dark` class on <html> (Tailwind `darkMode: 'class'`),
// persisted to localStorage under one key. An inline <head> script in
// nuxt.config.ts applies the saved class before first paint, so this
// composable only has to keep Vue state in sync and handle toggles.
const STORAGE_KEY = 'vaulted-theme'

export function useTheme() {
  // Dark is the default for first-time visitors (matches the head script).
  const isDark = useState<boolean>('theme-dark', () => true)

  function apply() {
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', isDark.value)
    }
  }

  /** Sync Vue state with the class the head script already set. Call once on mount. */
  function init() {
    if (!import.meta.client) return
    isDark.value = document.documentElement.classList.contains('dark')
  }

  function toggle() {
    isDark.value = !isDark.value
    apply()
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, isDark.value ? 'dark' : 'light')
      } catch {
        // Private mode / blocked storage: the toggle still works for the session.
      }
    }
  }

  return { isDark, toggle, init }
}
