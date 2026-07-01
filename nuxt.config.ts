// Nuxt configuration.
// Nuxt reads this file to know which modules to load, what global CSS to
// include, and how to render the <head> of every page. Almost everything in
// Nuxt is "convention over configuration", so this file stays small.
export default defineNuxtConfig({
  // Pins Nuxt's behaviour to a date so future Nuxt updates don't silently
  // change how your app builds. Just set it once and forget it.
  compatibilityDate: '2025-07-01',

  // The in-browser Nuxt DevTools panel (bottom of the screen in dev).
  // Handy while learning — it shows routes, payloads, and component trees.
  devtools: { enabled: true },

  // Modules are plug-ins that extend Nuxt. The Tailwind module wires up
  // Tailwind CSS for us: it finds our classes, generates the stylesheet, and
  // hot-reloads it. No manual PostCSS config needed.
  modules: ['@nuxtjs/tailwindcss'],

  // Global stylesheet — loaded on every page. This is where Tailwind's base
  // layers and our small set of reusable component classes live.
  css: ['~/assets/css/main.css'],

  // Everything inside <head>. We set the tab title, viewport (for mobile), a
  // description, and load our three Google Fonts once for the whole app.
  app: {
    head: {
      title: 'Ledger — Expense Tracker',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content: 'A simple, professional expense tracker built with Nuxt 3 and Prisma.'
        }
      ],
      link: [
        // preconnect makes the font files start downloading a little sooner.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap'
        }
      ]
    }
  }
})
