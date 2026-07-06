import type { Config } from 'tailwindcss'

// Tailwind configuration.
// Design tokens for the app's "professional finance" theme: a slate/gray base,
// near-black text, and two semantic accents — `positive` (muted teal) for
// income / under-budget / downward spending, and `negative` (muted crimson)
// for expenses / over-budget / upward spending. Components reference these
// names (`bg-surface`, `text-positive`) instead of raw hex codes, and the
// full built-in slate scale stays available for neutral shades in between.
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        // Surfaces
        surface: '#F8FAFC', // app background (slate-50)
        panel: '#FFFFFF', // cards and raised surfaces
        subtle: '#F1F5F9', // muted fills: skeletons, hovers, chart tracks (slate-100)
        edge: '#E2E8F0', // hairline borders and dividers (slate-200)

        // Text
        ink: {
          DEFAULT: '#0F172A', // primary text (slate-900)
          soft: '#64748B', // secondary text, labels, captions (slate-500)
          strong: '#1E293B' // hover state for ink-filled controls (slate-800)
        },

        // Semantic accents
        positive: {
          DEFAULT: '#0F766E', // muted teal — income, savings, under budget
          dark: '#115E59', // hover / pressed
          soft: '#CCFBF1' // tinted fills behind positive figures
        },
        negative: {
          DEFAULT: '#9F1239', // muted crimson — expenses, over budget
          dark: '#881337', // hover / pressed
          soft: '#FFE4E6' // tinted fills behind negative figures
        }
      },
      fontFamily: {
        // One clean grotesque for everything; weight and size carry hierarchy.
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Monospace for money and dates so columns of figures line up.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        // A soft, low card shadow — present but never heavy.
        card: '0 1px 2px rgba(15,23,42,0.04), 0 12px 28px -16px rgba(15,23,42,0.12)'
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scale-in 0.18s cubic-bezier(0.16, 1, 0.3, 1) both'
      }
    }
  }
}
