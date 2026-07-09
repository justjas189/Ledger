// Focus management for overlay dialogs (ROADMAP §2, "Focus + live regions").
// Shared by Modal, Drawer and the command palette so the fiddly parts live
// in exactly one place:
//   • remembers the element that had focus when the overlay opened and
//     returns focus to it on close (so keyboard users aren't dropped at the
//     top of the page after dismissing a dialog)
//   • keeps Tab / Shift+Tab cycling inside the overlay panel
//   • marks the app root `inert` while any overlay is open — the page behind
//     becomes unfocusable AND invisible to screen readers. Overlays teleport
//     to <body>, outside the app root, so they stay live.
//   • routes Escape to the TOPMOST overlay only, so stacked overlays (the
//     delete confirmation over the edit drawer) close one at a time instead
//     of all at once.
//
// A module-level stack of open traps decides who is "topmost". The stack is
// client-only state — overlays never open during SSR.

const trapStack: symbol[] = []

// What can receive keyboard focus inside a panel. `tabindex="-1"` hosts
// (the panels themselves, the hidden receipt input) are deliberately out.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function appRoot(): HTMLElement | null {
  return document.getElementById('__nuxt')
}

export function useFocusTrap(panel: Ref<HTMLElement | null>, onEscape?: () => void) {
  const id = Symbol('focus-trap')
  let trigger: HTMLElement | null = null
  let active = false

  const isTop = () => trapStack[trapStack.length - 1] === id

  /** Visible, tabbable elements inside the panel, in DOM order. */
  function focusables(): HTMLElement[] {
    const root = panel.value
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0
    )
  }

  // Capture phase so the trap wins over any per-component key handlers, and
  // `isTop()` so only the front overlay of a stack reacts.
  function onKeydown(e: KeyboardEvent) {
    if (!active || !isTop()) return

    if (e.key === 'Escape' && onEscape) {
      e.preventDefault()
      onEscape()
      return
    }
    if (e.key !== 'Tab') return

    const root = panel.value
    if (!root) return
    const list = focusables()
    if (list.length === 0) {
      // Nothing tabbable — park focus on the panel itself.
      e.preventDefault()
      root.focus()
      return
    }
    const current = document.activeElement as HTMLElement | null
    const inside = !!current && root.contains(current)
    if (e.shiftKey) {
      if (!inside || current === list[0]) {
        e.preventDefault()
        list[list.length - 1].focus()
      }
    } else if (!inside || current === list[list.length - 1]) {
      e.preventDefault()
      list[0].focus()
    }
  }

  function activate() {
    if (active || import.meta.server) return
    active = true
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    trapStack.push(id)
    // First overlay in: freeze the page behind. (The attribute also blocks
    // pointer events, so the backdrop click handlers on the overlays —
    // which live outside the root — keep working.)
    if (trapStack.length === 1) appRoot()?.setAttribute('inert', '')
    window.addEventListener('keydown', onKeydown, true)
    nextTick(() => panel.value?.focus())
  }

  function deactivate() {
    if (!active) return
    active = false
    window.removeEventListener('keydown', onKeydown, true)
    const i = trapStack.indexOf(id)
    if (i !== -1) trapStack.splice(i, 1)
    // Lift inert BEFORE restoring focus — an inert element can't be focused.
    if (trapStack.length === 0) appRoot()?.removeAttribute('inert')
    if (trigger?.isConnected) trigger.focus()
    trigger = null
  }

  return { activate, deactivate }
}
