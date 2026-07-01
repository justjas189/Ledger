// A tiny toast-notification system.
//
// Components call `useToast().success('Saved')` and a little message slides in
// (rendered once by <AppToasts> in the layout). We keep the list of toasts in
// `useState` so it's a single shared array across the whole app.
export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

// Module-level counter guarantees every toast gets a unique id.
let seq = 0

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(message: string, type: Toast['type']) {
    const id = ++seq
    toasts.value = [...toasts.value, { id, message, type }]
    // Auto-dismiss after a few seconds.
    setTimeout(() => dismiss(id), 4000)
  }

  return {
    toasts,
    dismiss,
    success: (m: string) => push(m, 'success'),
    error: (m: string) => push(m, 'error'),
    info: (m: string) => push(m, 'info')
  }
}
