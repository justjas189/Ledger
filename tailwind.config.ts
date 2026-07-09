import type { Config } from 'tailwindcss'

// Tailwind configuration.
// Design tokens for Vaulted's "professional FinTech" theme. Two themes, one
// token set: light (off-white canvas, white cards, charcoal ink) and dark
// (near-black canvas, charcoal cards, off-white ink), switched manually via
// the `.dark` class on <html> (see composables/useTheme.ts).
//
// The theme-dependent colors are CSS variables (RGB triplets, defined in
// assets/css/main.css) so components and charts can say `text-ink` or
// `rgb(var(--accent) / 0.3)` and get the right value in either mode without
// sprinkling `dark:` everywhere. One accent — emerald — reserved for the
// primary action and key positive highlights.
export default <Partial<Config>>{
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Text, in three strengths. Flips charcoal ↔ off-white with the theme.
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)', // primary text
          soft: 'rgb(var(--ink-soft) / <alpha-value>)', // secondary text, labels
          faint: 'rgb(var(--ink-faint) / <alpha-value>)' // tertiary: eyebrows, hints
        },

        // The "separator base": black in light mode, white in dark mode.
        // Used at low opacities for hairline borders, dividers, subtle fills.
        edge: 'rgb(var(--edge) / <alpha-value>)',

        // The single accent. `DEFAULT` is the fixed fill (emerald-500, both
        // themes); `strong` is the text/stroke-safe step (emerald-600 on
        // light, emerald-400 on dark) so contrast holds in both.
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)'
        },

        // Semantic accents. Positive shares the accent hue (the brief's "key
        // positive data highlights"); negative is a contrast-safe rose.
        positive: 'rgb(var(--accent-strong) / <alpha-value>)',
        negative: 'rgb(var(--negative) / <alpha-value>)'
      },
      fontFamily: {
        // One workhorse family — Inter — for both display and body; weight
        // and tracking do the differentiating. Monospace for money and dates
        // so columns of figures line up.
        display: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace']
      },
      keyframes: {
        // Entrance used for staggered reveals: rises and settles.
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pop: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        // Gentle bob for the category bubbles.
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' }
        }
      },
      animation: {
        rise: 'rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        pop: 'pop 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 5s ease-in-out infinite'
      }
    }
  }
}
