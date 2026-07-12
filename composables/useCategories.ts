// Loads the list of categories from the API, and exposes mutations for
// creating/removing custom ones.
//
// `useFetch` with a fixed `key` means Nuxt fetches once and shares the result
// across every component that calls this. `addCategory`/`deleteCategory` call
// the shared `refresh()` after the request resolves, which re-runs the GET
// and updates every consumer — the dropdown, filter bar, and bubble chart —
// through the same mechanism Nuxt uses to keep them in sync on first load.
import type { CategoryDTO } from '~/types/expense'
import { refreshSpendingCaches } from '~/composables/useSpendingCaches' // <-- NEW: Import the master cache buster

/** Fields the user supplies when creating a category. `icon` is optional —
 * there's no icon picker in the UI yet, so it's usually omitted (null). */
export interface CategoryInput {
  name: string
  color: string
  icon?: string | null
}

export function useCategories() {
  const fetched = useFetch<CategoryDTO[]>('/api/categories', {
    key: 'category-list-cache', // <-- FIX: Explicitly named cache key
    default: () => [] // start with an empty array so `.map()` is always safe
  })

  /** Create a category. Resolves once every consumer has the fresh list. */
  async function addCategory(payload: CategoryInput): Promise<CategoryDTO> {
    const created = await $fetch<CategoryDTO>('/api/categories', {
      method: 'POST',
      body: payload
    })
    
    // FIX: Force-clear the specific cache key before refreshing
    clearNuxtData('category-list-cache') 
    
    // THE FIX: Fire both the local category refresh AND the master stats cache buster
    await Promise.all([fetched.refresh(), refreshSpendingCaches()])
    return created
  }

  /** Permanently delete a category. The server rejects (409) if any expense
   * still uses it, so callers should surface that error rather than assume
   * success. */
  async function deleteCategory(id: string): Promise<void> {
    await $fetch(`/api/categories/${id}`, { method: 'DELETE' })
    
    // FIX: Force-clear the specific cache key before refreshing
    clearNuxtData('category-list-cache') 
    
    // THE FIX: Fire both the local category refresh AND the master stats cache buster
    await Promise.all([fetched.refresh(), refreshSpendingCaches()])
  }

  return { ...fetched, addCategory, deleteCategory }
}