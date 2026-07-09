// A tiny toast-notification system.
//
// Components call `useToast().success('Saved')` and a little message slides in
// (rendered once by <AppToasts> in the layout). We keep the list of toasts in
// `useState` so it's a single shared array across the whole app.
//
// A toast can carry one optional action (e.g. the "Undo" on an optimistic
// delete): <AppToasts> renders it as a button, runs the handler, then
// dismisses the toast.
export interface ToastAction {
  label: string
  /** Runs when the user clicks the action; the toast dismisses itself after. */
  onAction: () => void
}

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  action?: ToastAction
}

export interface ToastOptions {
  /** How long the toast stays up, in ms. Defaults to 4000. */
  duration?: number
  action?: ToastAction
}

// Module-level counter guarantees every toast gets a unique id.
let seq = 0

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  function push(message: string, type: Toast['type'], opts: ToastOptions = {}) {
    const id = ++seq
    toasts.value = [...toasts.value, { id, message, type, action: opts.action }]
    // Auto-dismiss. Action toasts pass a duration matching their window.
    setTimeout(() => dismiss(id), opts.duration ?? 4000)
    return id
  }

  return {
    toasts,
    dismiss,
    success: (m: string, o?: ToastOptions) => push(m, 'success', o),
    error: (m: string, o?: ToastOptions) => push(m, 'error', o),
    info: (m: string, o?: ToastOptions) => push(m, 'info', o)
  }
}
