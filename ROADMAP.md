# Vaulted — Project Roadmap & Audit

This document outlines the architectural, UX, and feature improvements for the Vaulted application. Items marked with `🔒` require backend/API schema modifications and are deferred to a dedicated backend sprint.

## 1. Architecture & Performance

- [x] **P0 — Optimistic UI on mutations**
  > **Why:** Full round-trip before UI moves feels slow on 3G.
  - **How:** Patch `data.value.items` locally first, `$fetch` in background, rollback + toast on error. Remove row instantly on delete, hold actual `DELETE` 5s behind "Undo" toast.

- [x] **P0 — Cache `/api/stats` via routeRules**
  > **Why:** The dashboard is the most-hit page and fires 7 queries per visit.
  - **How:** Add `routeRules: { '/api/stats': { swr: 60 } }` in `nuxt.config.ts`. Update client `useFetch` with `getCachedData` for instant back-nav paints.

- [x] **P1 — Self-host fonts**
  > **Why:** Google Fonts are render-blocking and introduce GDPR noise.
  - **How:** Use `@nuxt/fonts` module and drop preconnect links from `nuxt.config.ts`.

- [x] **P1 — Lazy-load analytics charts**
  > **Why:** Charts hydrate on first paint even when below the fold.
  - **How:** `Lazy*` prefix + `hydrate-on-visible` on the calendar, daily bars, month-compare, budget rings and category bubbles — each chart's code now splits into its own async chunk and hydrates only when scrolled into view.

- [x] **P2 — Live exchange rates**
  > **Why:** Hardcoded rates drift and portfolio reviewers will notice.
  - **How:** `useCurrency` fetches `frankfurter.app` (free/no key) client-side once per day, caches in `localStorage` for 24h (stale cache still beats the static table), and keeps the hardcoded values as the offline fallback. Conversion stays display-only.

- [x] **P2 🔒 — Timezone-correct month buckets** *(unlock batch #1, applied 2026-07-09)*
  > **Why:** `stats/index.get.ts` computes month boundaries in server TZ, causing end-of-month entries to land in the wrong bucket for local users.
  - **How:** Optional `?tz=<IANA>` on `/api/stats` + `/api/stats/forecast`; boundaries/buckets/pace computed in that zone via `server/utils/timezone.ts`. Invalid/missing tz → legacy server-zone path.

- [x] **P2 🔒 — Search index at scale** *(unlock batch #1, applied 2026-07-09)*
  > **Why:** `contains insensitive` relies on sequential scans (fails >10k rows).
  - **How:** `pg_trgm` GIN index on description (migration `20260708170237_pg_trgm_description_index`); verified via EXPLAIN → Bitmap Index Scan.

---

## 2. UX Polish & Accessibility

- [x] **P0 — Swipe-to-delete + undo (Mobile)**
  > **Why:** Table rows on mobile need native-feeling gestures.
  - **How:** `@vueuse/core` `useSwipe` on row. Translate-X follows finger; past threshold triggers optimistic remove + undo toast + `navigator.vibrate(10)`.

- [x] **P0 — `prefers-reduced-motion` gate**
  > **Why:** Heavy motion fails WCAG 2.3.3 for vestibular users.
  - **How:** Global CSS `@media (prefers-reduced-motion: reduce)` kills transitions. JS animations check `matchMedia`.

- [x] **P1 — Charts need non-visual fallback**
  > **Why:** SVG/Canvas charts are unreadable to screen readers.
  - **How:** Add `role="img"` + `aria-label` summary per chart, plus a visually-hidden `<table>` with identical data.

- [x] **P1 — Skeletons match geometry**
  > **Why:** Standard spinners cause layout shift; geometry matching improves perceived speed.
  - **How:** Skeleton variants of StatCard + table rows, utilizing a CSS shimmer gradient with staggered 50ms delays.

- [x] **P1 — Three distinct empty states**
  > **Why:** One generic empty state confuses users across different contexts.
  - **How:** First-run -> Onboarding CTA; Filtered-empty -> "Clear filters" action; Error -> `<NuxtErrorBoundary>` per widget.

- [x] **P1 — Focus + live regions**
  > **Why:** Users get lost behind glass modals; silent failures for SR users.
  - **How:** Shared `useFocusTrap` in Modal/Drawer/palette: Tab cycles inside the panel, the app root goes `inert` (unfocusable + hidden from AT) while any overlay is open, Escape closes only the topmost overlay of a stack, and focus returns to the trigger on close. Toasts already carried `aria-live="polite"` + `aria-atomic`.

- [x] **P2 — Command palette (Ctrl+K)**
  > **Why:** Strong power-user signal and portfolio flex.
  - **How:** `CommandPalette.vue`, hosted in the layout, toggled with Ctrl/Cmd+K. Subsequence fuzzy scorer (word-start + streak bonuses) over routes + actions: quick-add, theme, the four display currencies, and the month report card. Combobox/listbox ARIA with `aria-activedescendant`; same focus trap as the dialogs.

- [x] **P2 — Contrast audit on monochrome**
  > **Why:** Zinc-on-zinc dark UIs routinely fail 4.5:1 on secondary text.
  - **How:** Muted ink tokens bumped one zinc step in both themes (dark `--ink-faint` zinc-500→400 was the ~3.9:1 failure; now ~6.9:1 on cards), and the `.glass` scrims solidified (`white/80`, `black/65`) so text over blur stays above 4.5:1.

---

## 3. ML & Advanced Data

- [x] **Feature 1 — Seasonal budget forecast**
  > **Why:** Linear pace projection is inaccurate. Weekday+payday-aware forecast builds user trust.
  - **How:** Client-side TS composable (`useForecast()`). Decompose 90d history into weekday means + monthly recurring spikes. Render as dashed continuation on trend chart.

- [x] **Feature 2 — Receipt OCR quick-add**
  > **Why:** Manual entry is the #1 churn reason. OCR provides a "magic moment" for demos.
  - **How:** Client uploads image -> in-browser OCR (tesseract.js — API is locked, so no server route) extracts `{description, amount, date, suggested category}` -> prefills `ExpenseForm.vue` -> user confirms.

- [x] **Feature 3 — Spending anomaly detection**
  > **Why:** Active guardian features beat passive charts. 
  - **How:** Compute rolling 90d per-category mean + MAD (Mean Absolute Deviation). Flag entries >3 MAD. Surface as quiet amber pill on expense row + digest toast *(digest since folded into the daily nudge queue — see §4)*.

- [x] **Bonus — Auto-categorization**
  > **Why:** Saves time, compounds with OCR.
  - **How:** Shared keyword map in `useAutoCategory` (word-boundary voting; single words must match whole words, phrases match as substrings), extended with typed-description vocabulary. The create form watches the description and moves the dropdown live — never overriding a hand-picked or OCR-derived category — with a small "suggested" hint. Receipt OCR votes over the same map.

---

## 4. Retention & Gamification (Subtle)

- [x] **Logging streak**
  > **Why:** Habit loop without a toy feel. Strongest retention primitive.
  - **How:** Compute from expense dates. Show as small mono-font counter in header. Break = grayed, not shamed.

- [x] **Week-in-review card**
  > **Why:** Reflection rituals build habits better than nagging.
  - **How:** Monday dashboard card (last week total, delta vs prior, top category, one anomaly). Dismissible.

- [x] **Savings goals with progress ring**
  > **Why:** Positive framing (targets) retains better than negative framing (ceilings/budgets).
  - **How:** `useSavingsGoals` store (localStorage, shape-validated on load; amounts base USD so they convert like everything else). Dashboard card renders one ring per goal in the exact `BudgetRings.vue` geometry — but the arc only celebrates (accent, never rose; a quiet "saved" chip at 100%). Add/contribute via a small Modal; delete gets the app's standard undo toast.

- [x] **Month-end report card (Shareable)**
  > **Why:** Organic acquisition + retention mechanic.
  - **How:** `MonthReportCard.vue` — a fixed-brand dark SVG (total, delta, top category, entries, busiest day, savings rate) previewed in a modal and rasterized to a 1080×1350 PNG via canvas. `navigator.share` with file support where available, download fallback everywhere. Opened from /analytics or the palette.

- [x] **Nudge budget limitation**
  > **Why:** Nudge spam leads to uninstalls.
  - **How:** `useNudges` gathers candidates (worst over-budget category > pace over income/budget > the month's anomaly digest, absorbed from `useAnomalies`), picks the single highest-severity item, and speaks at most once per day — `localStorage` tracks the last-shown date; no storage means no nudge at all.

---

## Execution Priority

1. **Optimistic UI + undo delete** *(Completed)*
2. **Skeletons + empty states + reduced-motion** *(Completed)*
3. **Receipt OCR** *(Completed — in-browser tesseract.js)*
4. **Client-side forecast + anomaly pills** *(Completed)*
5. **Streak + week-in-review** *(Completed — client-side from the 90d history pool)*
6. **routeRules SWR cache + self-host fonts** *(Completed — Nitro swr 60s + @nuxt/fonts)*
7. 🔒 **Backlog:** Timezone fix, `pg_trgm`, server-side forecast *(Completed — unlock batch #1 approved & applied 2026-07-09, see [UNLOCK-REQUEST.md](UNLOCK-REQUEST.md); forecast now served by `/api/stats/forecast` with the client computation kept as offline fallback)*
8. **Final frontend sprint** *(Completed 2026-07-09 — lazy charts, live rates, focus traps + inert, contrast bump, Ctrl+K palette, auto-categorization, savings goals, daily nudge queue, shareable month report card. Roadmap fully checked; API/schema untouched.)*