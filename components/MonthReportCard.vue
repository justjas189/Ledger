<script setup lang="ts">
// Month-end report card (ROADMAP §4, Retention) — the shareable summary.
// A fixed-brand SVG (always the dark treatment, like any wrapped-style
// share card) rendered live in a modal, then rasterized to a 1080×1350 PNG
// on demand: Web Share where the platform has it, a plain download
// everywhere else.
//
// Numbers come from a one-shot $fetch of the locked /api/stats payload (the
// Nitro swr rule makes this cheap), converted through the active display
// currency like every other figure in the app.
//
// Rasterization: XMLSerializer → data-URI <img> → canvas.drawImage →
// canvas.toBlob. The SVG references no external fonts or images, so the
// canvas stays untainted. Font families are system stacks by NAME — an SVG
// rendered as an image can use installed fonts but cannot fetch any.
import { Download, Share2 } from 'lucide-vue-next'
import type { StatsResponse } from '~/types/expense'
import { HISTORY_DAYS } from '~/composables/useExpenseHistory'

const { isOpen, close } = useReportCard()
const { peakForMonth } = useStreak()
const { formatMoney, formatMonthLabel, formatPercent } = useFormatters()
const toast = useToast()

const SANS = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
const MONO = "Consolas, 'SF Mono', 'Courier New', monospace"

// --- Data ------------------------------------------------------------------
const stats = ref<StatsResponse | null>(null)
const loading = ref(false)
const failed = ref(false)

async function fetchStats() {
  loading.value = true
  failed.value = false
  try {
    stats.value = await $fetch<StatsResponse>('/api/stats', {
      query: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone }
    })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
}

// Fresh numbers on every open — entries may have landed since the last one.
watch(
  () => isOpen.value,
  (open) => {
    if (open && import.meta.client) void fetchStats()
  }
)

function localMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Long category names shrink to fit their grid slot.
const clipName = (name: string) => (name.length > 16 ? `${name.slice(0, 15)}…` : name)

// Everything the SVG prints, precomputed as plain strings.
const card = computed(() => {
  // Income is authoritative in the /api/stats payload now (Profile.monthlyBudget),
  // so the card reads it directly — no client-side budget overlay.
  const s = stats.value
  if (!s) return null

  const monthKey = localMonthKey()

  // Habit metrics, derived client-side from the locked /api/stats payload.
  //
  // Most frequent = the category with the most individual entries this month
  // (breakdown carries per-category counts; ties go to the bigger spender,
  // since breakdown arrives sorted by total).
  let frequent: (typeof s.breakdown)[number] | null = null
  for (const b of s.breakdown) {
    if (b.count > (frequent?.count ?? 0)) frequent = b
  }

  // Longest streak = the peak GLOBAL streak reached during this month (from
  // the shared 90-day pool via useStreak), so the card always matches the
  // biggest number the header chip showed this month — a month-scoped count
  // would read lower whenever a run carried over from last month.
  const streak = peakForMonth(monthKey)

  // Busiest day = the month's highest single-day spend. dailyTrend (last 30
  // days, oldest first, zero-filled, ends today) spans the whole
  // month-to-date except day 1 of a 31-day month viewed on the 31st.
  let busiest: (typeof s.dailyTrend)[number] | null = null
  for (const p of s.dailyTrend) {
    if (!p.date.startsWith(monthKey) || p.total <= 0) continue
    if (p.total > (busiest?.total ?? 0)) busiest = p
  }

  const total = formatMoney(s.thisMonthTotal)
  const topName = s.topCategory ? clipName(s.topCategory.name) : '—'
  const hasIncome = s.monthlyIncome > 0

  return {
    month: formatMonthLabel(),
    total,
    // Long converted figures (₱ six digits…) shrink to stay inside the frame.
    totalSize: total.length > 12 ? 31 : total.length > 9 ? 38 : 46,
    deltaText:
      s.momChangePct === null
        ? 'first tracked month'
        : `${formatPercent(s.momChangePct)} vs last month`,
    // Spending UP is the rose outcome, DOWN the emerald one — flat/first stay neutral.
    deltaColor:
      s.momChangePct === null || s.momChangePct === 0
        ? '#A1A1AA'
        : s.momChangePct > 0
          ? '#FB7185'
          : '#34D399',
    topName,
    topTotal: s.topCategory ? formatMoney(s.topCategory.total) : 'nothing logged yet',
    count: String(s.thisMonthCount),
    frequentName: frequent ? clipName(frequent.name) : '—',
    frequentSub: frequent
      ? `${frequent.count} ${frequent.count === 1 ? 'entry' : 'entries'} logged`
      : 'nothing logged yet',
    streak:
      streak >= HISTORY_DAYS
        ? `${HISTORY_DAYS}+ days`
        : streak > 0
          ? `${streak} ${streak === 1 ? 'day' : 'days'}`
          : '—',
    streakSub: streak > 0 ? 'logged in a row' : 'no entries yet',
    busiestName: busiest
      ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
          new Date(`${busiest.date}T00:00:00`)
        )
      : '—',
    busiestSub: busiest ? `${formatMoney(busiest.total)} spent` : 'no entries yet',
    savingsName: hasIncome ? `${s.savingsRate.toFixed(1)}%` : '—',
    savingsSub: hasIncome ? 'saved to goals' : 'no income set'
  }
})

// --- PNG export --------------------------------------------------------------
const svgEl = ref<SVGSVGElement | null>(null)
const exporting = ref(false)

const fileName = computed(() => `vaulted-${localMonthKey()}.png`)

// Only offer the share button where the platform can actually share files.
const shareSupported = computed(
  () => import.meta.client && typeof navigator !== 'undefined' && typeof navigator.share === 'function'
)

async function renderPng(): Promise<Blob> {
  const svg = svgEl.value
  if (!svg) throw new Error('no svg')
  const xml = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('svg decode failed'))
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  })
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('rasterize failed')
  return blob
}

async function download() {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await renderPng()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName.value
    a.click()
    // Give the browser a beat to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Report card saved as a PNG.')
  } catch {
    toast.error("Couldn't render the report card. Please try again.")
  } finally {
    exporting.value = false
  }
}

async function share() {
  if (exporting.value) return
  exporting.value = true
  try {
    const blob = await renderPng()
    const file = new File([blob], fileName.value, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Vaulted — ${card.value?.month ?? ''}` })
    } else {
      // share() exists but can't take files (some desktop browsers) —
      // quietly hand over the PNG instead.
      exporting.value = false
      await download()
      return
    }
  } catch (err) {
    // The user backing out of the share sheet is not an error.
    if ((err as Error)?.name !== 'AbortError') {
      toast.error("Couldn't share the report card. Try the download instead.")
    }
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <Modal :open="isOpen" title="Month report card" max-width="max-w-lg" @close="close()">
    <!-- Loading: geometry-matched to the 4:5 card. -->
    <div v-if="loading" class="skeleton aspect-[4/5] w-full rounded-xl" />

    <!-- Error -->
    <div v-else-if="failed" class="py-10 text-center">
      <p class="text-sm text-ink-soft">Couldn't load this month's numbers.</p>
      <button type="button" class="btn btn-ghost mt-4" @click="fetchStats()">Retry</button>
    </div>

    <!-- The card itself: what you see is exactly what exports. -->
    <div v-else-if="card">
      <svg
        ref="svgEl"
        viewBox="0 0 540 675"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        :aria-label="`${card.month} report card: ${card.total} spent, top category ${card.topName}, longest streak ${card.streak}`"
        class="w-full rounded-xl"
      >
        <!-- Canvas -->
        <rect width="540" height="675" fill="#09090B" />
        <rect width="540" height="5" fill="#10B981" />
        <!-- Faint dial ghost, echoing the vault mark -->
        <circle cx="472" cy="96" r="120" fill="none" stroke="#10B981" stroke-opacity="0.06" stroke-width="34" />
        <circle cx="472" cy="96" r="64" fill="none" stroke="#10B981" stroke-opacity="0.09" stroke-width="1.5" />

        <!-- Brand row: the shield mark (favicon.svg, inlined so the PNG
             export never fetches an external image) + wordmark -->
        <g transform="translate(44 38) scale(0.26)" fill="none">
          <path d="M 25 28 Q 50 8 75 28" stroke="#00A859" stroke-width="7" stroke-linecap="round"/>
          <path d="M 12 32 C 12 65 30 90 50 98 C 70 90 88 65 88 32 L 74 36 C 70 60 60 80 50 86 C 40 80 30 60 26 36 Z" fill="#004B36"/>
          <circle cx="50" cy="52" r="12" stroke="#00A859" stroke-width="4"/>
          <circle cx="50" cy="52" r="4" fill="#00A859"/>
          <line x1="50" y1="30" x2="50" y2="36" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
          <line x1="50" y1="68" x2="50" y2="74" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
          <line x1="30" y1="52" x2="36" y2="52" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
          <line x1="64" y1="52" x2="70" y2="52" stroke="#00A859" stroke-width="4" stroke-linecap="round"/>
        </g>
        <text x="78" y="57" :font-family="SANS" font-size="15" font-weight="700" fill="#FAFAFA">
          Vaulted
        </text>

        <!-- Month -->
        <text x="44" y="108" :font-family="SANS" font-size="11" font-weight="600" letter-spacing="3" fill="#71717A">
          MONTH IN REVIEW
        </text>
        <text x="44" y="140" :font-family="SANS" font-size="30" font-weight="800" fill="#FAFAFA">
          {{ card.month }}
        </text>

        <!-- Hero total -->
        <text x="44" y="196" :font-family="SANS" font-size="11" font-weight="600" letter-spacing="3" fill="#71717A">
          TOTAL SPENT
        </text>
        <text x="44" y="246" :font-family="MONO" :font-size="card.totalSize" font-weight="700" fill="#FAFAFA">
          {{ card.total }}
        </text>
        <text x="44" y="274" :font-family="MONO" font-size="14" :fill="card.deltaColor">
          {{ card.deltaText }}
        </text>

        <line x1="44" y1="304" x2="496" y2="304" stroke="#FFFFFF" stroke-opacity="0.08" />

        <!-- Stat grid: 2 × 3 -->
        <text x="44" y="342" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          TOP CATEGORY
        </text>
        <text x="44" y="368" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.topName }}
        </text>
        <text x="44" y="388" :font-family="MONO" font-size="12" fill="#A1A1AA">
          {{ card.topTotal }}
        </text>

        <text x="290" y="342" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          ENTRIES
        </text>
        <text x="290" y="368" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.count }}
        </text>
        <text x="290" y="388" :font-family="MONO" font-size="12" fill="#A1A1AA">
          logged this month
        </text>

        <text x="44" y="434" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          MOST FREQUENT
        </text>
        <text x="44" y="460" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.frequentName }}
        </text>
        <text x="44" y="480" :font-family="MONO" font-size="12" fill="#A1A1AA">
          {{ card.frequentSub }}
        </text>

        <text x="290" y="434" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          LONGEST STREAK
        </text>
        <text x="290" y="460" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.streak }}
        </text>
        <text x="290" y="480" :font-family="MONO" font-size="12" fill="#A1A1AA">
          {{ card.streakSub }}
        </text>

        <text x="44" y="526" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          BUSIEST DAY
        </text>
        <text x="44" y="552" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.busiestName }}
        </text>
        <text x="44" y="572" :font-family="MONO" font-size="12" fill="#A1A1AA">
          {{ card.busiestSub }}
        </text>

        <text x="290" y="526" :font-family="SANS" font-size="10.5" font-weight="600" letter-spacing="2.5" fill="#71717A">
          SAVINGS RATE
        </text>
        <text x="290" y="552" :font-family="SANS" font-size="20" font-weight="700" fill="#FAFAFA">
          {{ card.savingsName }}
        </text>
        <text x="290" y="572" :font-family="MONO" font-size="12" fill="#A1A1AA">
          {{ card.savingsSub }}
        </text>

        <line x1="44" y1="604" x2="496" y2="604" stroke="#FFFFFF" stroke-opacity="0.08" />
        <text x="44" y="638" :font-family="MONO" font-size="11" fill="#71717A">
          Vaulted · Secure Today. Empower Tomorrow.
        </text>
      </svg>

      <p class="mt-3 text-center font-mono text-xs text-ink-faint">
        Exports as a 1080 × 1350 PNG — story-ready.
      </p>
    </div>

    <template #footer>
      <button
        v-if="shareSupported && card && !loading && !failed"
        type="button"
        class="btn btn-ghost"
        :disabled="exporting"
        @click="share()"
      >
        <Share2 class="h-4 w-4" aria-hidden="true" />
        Share
      </button>
      <button
        type="button"
        class="btn btn-primary"
        :disabled="exporting || loading || failed || !card"
        @click="download()"
      >
        <Download class="h-4 w-4" aria-hidden="true" />
        {{ exporting ? 'Rendering…' : 'Download PNG' }}
      </button>
    </template>
  </Modal>
</template>
