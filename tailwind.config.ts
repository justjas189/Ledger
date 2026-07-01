import type { Config } from 'tailwindcss'

// Tailwind configuration.
// This is where we define our design tokens — the specific colours and fonts
// that give the app its "ledger" identity. Instead of scattering hex codes
// through the components, we name them here once and reference them as
// utility classes (e.g. `bg-pine`, `text-ink-soft`, `font-mono`).
export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        // Surfaces
        paper: '#F6F7F2', // app background — a warm, faintly green off-white
        panel: '#FFFFFF', // cards and raised surfaces
        ledger: '#E8EEDF', // the pale "greenbar" tint used for ledger rows
        rule: '#CBD8C0', // hairline ruling lines / borders

        // Text
        ink: {
          DEFAULT: '#16231B', // primary text — a near-black with a green cast
          soft: '#5C6B60' // secondary text, labels, captions
        },

        // Brand / accents
        pine: {
          DEFAULT: '#1E5A48', // primary money-green: header, primary buttons
          dark: '#16483A' // hover / pressed
        },
        clay: '#B23A2E', // spend & destructive actions (delete, over-budget)
        brass: '#B7892F' // highlight, focus rings, chart accent
      },
      fontFamily: {
        // A high-contrast serif for display moments (the wordmark, big totals).
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        // The everyday UI face — a clean, slightly warm grotesque.
        sans: ['"Hanken Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Monospace for money and dates so columns of figures line up.
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      boxShadow: {
        // A soft, low card shadow — present but never heavy.
        card: '0 1px 2px rgba(22,35,27,0.04), 0 12px 28px -16px rgba(22,35,27,0.18)'
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
