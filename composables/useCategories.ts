// Loads the list of categories from the API.
//
// `useFetch` with a fixed `key` means Nuxt fetches once and shares the result
// across every component that calls this — the dropdown, the filter bar, etc.
// all reuse the same data instead of each making their own request.
import type { CategoryDTO } from '~/types/expense'

export function useCategories() {
  return useFetch<CategoryDTO[]>('/api/categories', {
    key: 'categories',
    default: () => [] // start with an empty array so `.map()` is always safe
  })
}
