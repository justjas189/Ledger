# Vaulted Improvement Plan

## 1. Account Chip + Auth Polish
- [x] **Account Menu (Header or Dock)**
  - [x] Display user email.
  - [x] Implement sign out (`supabase.auth.signOut()` + redirect `/login`).
  - [x] Add theme and currency shortcuts.
  - [x] Add "Edit budget" entry.
- [x] **`login.vue` Polish**
  - [x] Implement glass card design.
  - [x] Add inlined Vaulted shield logo.
  - [x] Add mode crossfade.
  - [x] Add error shake animation.
  - [x] Add password visibility toggle.
  - [x] Implement loading button states.
- [x] **`confirm.vue` Polish**
  - [x] Apply same premium design and states as `login.vue`.

## 2. Motion Choreography Pass
- [x] **Page Transitions**
  - [x] Add route fade/slide via `nuxt.config`.
- [x] **Dashboard Animations**
  - [x] Add staggered card entrances (to match existing ring/bubble sweeps).
  - [x] Extend count-up ticker to the three metric tiles.
- [x] **Accessibility**
  - [x] Ensure all new animations respect existing `useReducedMotion`.

## 3. Empty States + First-Run
- [ ] **Post-Onboarding UX**
  - [ ] Implement guided "press N" hero for fresh users.
  - [ ] Design and add illustrated empty states for each card.
  - [ ] Add sample-data hint (currently only exists on the goals card).

## 4. Mobile + PWA Feel
- [x] **Mobile UI Adjustments**
  - [x] Add safe-area insets for the dock.
  - [x] Refactor `ExpenseTable` to stack as card rows under `sm:` breakpoint.
- [x] **PWA Configuration**
  - [x] Add web manifest and icons to make the app installable (placeholder SVG icons at `/public` root — swap for final PNG art later).
  - [x] Add Zinc `theme-color` meta tag.
- [x] **Extra: Interactive budget rings** — dashboard rings link to `/expenses` pre-filtered by category + current month.

## 5. A11y / Keyboard Sweep
- [x] **Keyboard Navigation**
  - [x] Perform `focus-visible` audit (global outline-based ring in `main.css`).
  - [x] Implement a skip link (`layouts/default.vue` → `#main-content`).
  - [x] Ensure Escape key and focus-trap consistency across Modals, Drawers, and the Command Palette (shared `useFocusTrap`; Escape now stops at the topmost layer; `WelcomeModal` trapped + teleported, Escape still disabled by design).