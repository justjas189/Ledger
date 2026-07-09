// The optimistic client-side layer over the locked expenses API.
//
// Two shared lists drive it:
//   • pendingAdds — expenses shown the instant the quick-add drawer closes,
//     before the POST resolves. Swapped for the real server row on refresh.
//   • hiddenIds   — expenses removed from view the instant "delete" is
//     pressed. The real DELETE only fires after a 5s undo window.
//
// The server stays the source of truth: every optimistic change either
// converges to it (refresh) or rolls back (undo / request failure). The API
// payloads are untouched — this is purely a display-layer buffer.
import type { ExpenseDTO } from '~/types/expense'

/** How long the Undo toast keeps a delete revocable. */
export const UNDO_WINDOW_MS = 5000

// Timers are client-only and never serialized, so a module-level map is safe.
const deleteTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function useOptimisticExpenses() {
  const pendingAdds = useState<ExpenseDTO[]>('optimistic-adds', () => [])
  const hiddenIds = useState<string[]>('optimistic-hidden-ids', () => [])
  const toast = useToast()

  function addPending(expense: ExpenseDTO) {
    pendingAdds.value = [expense, ...pendingAdds.value]
  }
  function removePending(id: string) {
    pendingAdds.value = pendingAdds.value.filter((e) => e.id !== id)
  }

  function hide(id: string) {
    if (!hiddenIds.value.includes(id)) hiddenIds.value = [...hiddenIds.value, id]
  }
  function unhide(id: string) {
    hiddenIds.value = hiddenIds.value.filter((v) => v !== id)
  }

  /**
   * Optimistic delete with an undo window: the row vanishes now, the DELETE
   * request fires after 5 seconds unless the user clicks Undo. `onCommitted`
   * runs after a successful DELETE (typically a list refresh) and BEFORE the
   * id is unhidden, so the row never flashes back in.
   */
  function scheduleDelete(expense: ExpenseDTO, onCommitted?: () => void | Promise<void>) {
    hide(expense.id)

    const commit = async () => {
      deleteTimers.delete(expense.id)
      try {
        await $fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
        // Every cached consumer of this row's numbers refetches here (stats
        // payload, expenses list, forecast — see refreshSpendingCaches), so
        // dashboards update without a reload no matter which page fired the
        // delete. Then the caller's own convergence step, then unhide.
        await refreshSpendingCaches()
        await onCommitted?.()
        unhide(expense.id) // the refreshed list no longer contains the id
      } catch (err: unknown) {
        unhide(expense.id) // roll back: the row reappears where it was
        const body = (err as { data?: { statusMessage?: string } })?.data
        toast.error(body?.statusMessage || 'Could not delete this entry — it has been restored.')
      }
    }

    deleteTimers.set(expense.id, setTimeout(commit, UNDO_WINDOW_MS))

    toast.info(`Deleted “${expense.description}”.`, {
      duration: UNDO_WINDOW_MS,
      action: {
        label: 'Undo',
        onAction: () => {
          const timer = deleteTimers.get(expense.id)
          if (timer) clearTimeout(timer)
          deleteTimers.delete(expense.id)
          unhide(expense.id)
        }
      }
    })
  }

  return { pendingAdds, hiddenIds, addPending, removePending, hide, unhide, scheduleDelete }
}
