<script setup lang="ts">
// Illustrated empty state for the "Where it went" card. A ghost bubble pack
// mirrors CategoryBubbles' output — bigger bubble, bigger share — so a new
// user sees what the space becomes before any spending exists. Decorative
// only (aria-hidden); the copy underneath carries the message. Bubbles bob
// with the existing `float` keyframe (frozen by the reduced-motion rule).
//
// Labels come from the user's OWN categories (useCategories -> GET
// /api/categories, the same list ExpenseForm's dropdown reads, already
// cached under the 'categories' key so this costs no extra request) instead
// of hardcoded placeholders — a fresh account's seeded categories are
// Groceries/Dining/Transport/Utilities/Entertainment/Shopping, and a
// returning user may have renamed or added their own, so this stays correct
// either way.
const emit = defineEmits<{ action: [] }>()

const { data: categories } = useCategories()

// Shrink-to-fit labels: these are raw SVG shapes, not CSS boxes, so there's no
// container-query axis to lean on. Instead we measure each label's ACTUAL
// rendered width — via an offscreen canvas, in the same Inter/medium the text
// renders with — and solve for the largest font-size that keeps it inside the
// bubble's usable width. Pure proportional scaling (no textLength squish, no
// truncation): a long category name just renders smaller, never clipped.
const BASE_FONT_PX = 11 // matches the old fixed text-[11px]
const MIN_FONT_PX = 6.5 // legibility floor — still fully rendered, just small
let measureCtx: CanvasRenderingContext2D | null | undefined

function textWidthAt(text: string, fontPx: number): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return text.length * fontPx * 0.6 // no canvas support: rough estimate
  measureCtx.font = `500 ${fontPx}px Inter, ui-sans-serif, system-ui, sans-serif`
  return measureCtx.measureText(text).width
}

/** Largest font-size (never below MIN_FONT_PX) that keeps `text` within `maxWidth`. */
function fitFontSize(text: string, maxWidth: number): number {
  if (!text) return BASE_FONT_PX
  const atBase = textWidthAt(text, BASE_FONT_PX)
  if (atBase <= maxWidth) return BASE_FONT_PX
  // Glyph width scales ~linearly with font-size for a fixed string/font, so
  // one proportional correction lands within a fraction of a pixel of exact.
  return Math.max(MIN_FONT_PX, BASE_FONT_PX * (maxWidth / atBase))
}

// Canvas measures against a fallback sans-serif until the self-hosted Inter
// webfont (@nuxt/fonts) finishes loading — close, but not exact — so this
// flips once fonts are ready and the computed below re-measures precisely.
const fontsReady = ref(false)
if (import.meta.client) {
  document.fonts?.ready?.then(() => { fontsReady.value = true }).catch(() => {})
}

// A hand-packed layout: one dominant slice, a few smaller ones. Position,
// size, pct and delay are purely decorative geometry (unchanged); only the
// two smallest bubbles stay unlabeled — same "too small to fit text" rule as
// before, now just applied to real names instead of fixed ones.
const bubbles = computed(() => {
  void fontsReady.value // re-measure once the real webfont lands
  const slots = [
    { cx: 105, cy: 90, r: 54, label: categories.value[0]?.name ?? '', pct: '44%', delay: '0s' },
    { cx: 200, cy: 62, r: 36, label: categories.value[1]?.name ?? '', pct: '', delay: '0.7s' },
    { cx: 248, cy: 124, r: 26, label: categories.value[2]?.name ?? '', pct: '', delay: '1.4s' },
    { cx: 52, cy: 34, r: 18, label: '', pct: '', delay: '0.4s' },
    { cx: 168, cy: 140, r: 14, label: '', pct: '', delay: '1s' }
  ]
  // Usable width: the widest horizontal chord near the label's vertical
  // offset, minus a margin so text never touches the bubble's edge.
  return slots.map((s) => ({ ...s, fontSize: fitFontSize(s.label, s.r * 1.7) }))
})
</script>

<template>
  <div>
    <div class="relative" aria-hidden="true">
      <span
        class="pointer-events-none absolute -top-1 right-0 rounded-full border border-edge/10 bg-edge/5 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-widest text-ink-faint"
      >
        Sample
      </span>

      <svg viewBox="0 0 300 170" class="mx-auto mt-1 w-full max-w-xs">
        <g
          v-for="b in bubbles"
          :key="`${b.cx}-${b.cy}`"
          class="animate-float"
          :style="{ animationDelay: b.delay }"
        >
          <circle
            :cx="b.cx"
            :cy="b.cy"
            :r="b.r"
            style="fill: rgb(var(--accent) / 0.1); stroke: rgb(var(--accent) / 0.3)"
            stroke-width="1.5"
          />
          <text
            v-if="b.label"
            :x="b.cx"
            :y="b.pct ? b.cy - 4 : b.cy + 4"
            text-anchor="middle"
            class="font-medium"
            :style="{ fill: 'rgb(var(--ink-faint))', fontSize: `${b.fontSize}px` }"
          >
            {{ b.label }}
          </text>
          <text
            v-if="b.pct"
            :x="b.cx"
            :y="b.cy + 14"
            text-anchor="middle"
            class="font-mono text-[11px] font-semibold"
            style="fill: rgb(var(--ink-faint))"
          >
            {{ b.pct }}
          </text>
        </g>
      </svg>
    </div>

    <div class="mt-4 text-center">
      <p class="font-medium text-ink">Nothing spent this month</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-ink-faint">
        Your categories pack this space as bubbles — the bigger the bubble, the bigger
        its share of the month.
      </p>
      <button type="button" class="btn btn-ghost mt-4" @click="emit('action')">
        Add an expense to see it
      </button>
    </div>
  </div>
</template>
