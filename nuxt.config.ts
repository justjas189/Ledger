// Nuxt configuration.
// Nuxt reads this file to know which modules to load, what global CSS to
// include, and how to render the <head> of every page. Almost everything in
// Nuxt is "convention over configuration", so this file stays small.
export default defineNuxtConfig({
  // Pins Nuxt's behaviour to a date so future Nuxt updates don't silently
  // change how your app builds. Just set it once and forget it.
  compatibilityDate: '2025-07-01',

  // The in-browser Nuxt DevTools panel (bottom of the screen in dev).
  devtools: { enabled: true },

  // Allow localtunnel hosts (*.loca.lt) through Vite's dev-server host check,
  // so phone-testing via localtunnel doesn't hit "Blocked request".
  vite: {
    server: {
      allowedHosts: ['.loca.lt', '.trycloudflare.com']
    }
  },

  // Modules are plug-ins that extend Nuxt. The Tailwind module wires up
  // Tailwind CSS for us: it finds our classes, generates the stylesheet, and
  // hot-reloads it. @nuxt/fonts downloads our two families at build time and
  // serves them from our own origin — no render-blocking Google request, no
  // third-party GDPR noise.
  modules: ['@nuxtjs/tailwindcss', '@nuxt/fonts', '@nuxtjs/supabase'],

  // Supabase auth. The module reads SUPABASE_URL + SUPABASE_KEY from env and
  // gates every route: unauthenticated visitors are redirected to /login. Only
  // the auth pages are public (exclude). On the server, serverSupabaseUser()
  // reads the same session cookie, so the API's tenant scoping needs no client
  // changes — existing useFetch('/api/…') calls just carry the cookie.
  supabase: {
    // Supabase is AUTH only here; Prisma owns all data access, so we don't need
    // the module's generated Database types — turn them off (silences the
    // "database.types.ts not found" warning).
    types: false,
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/login', '/confirm']
    }
  },

  // Self-hosted fonts: the exact weights the UI uses (see tailwind.config.ts
  // fontFamily). @nuxt/fonts fetches the files once at build, emits the
  // @font-face rules, and serves everything from /_fonts.
  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700, 800] },
      { name: 'JetBrains Mono', provider: 'google', weights: [400, 500, 600] }
    ]
  },

  // Nitro route rules.
  //
  // `/proxy/rates` is a transparent server-side proxy to frankfurter.app so
  // the browser fetches exchange rates same-origin — no CORS preflight, no
  // blocked cross-site request. Query params (?from=USD&to=…) pass through.
  //
  // The former `swr: 60` rules on /api/stats and /api/stats/forecast are
  // gone deliberately: a server-cached render kept serving PRE-MUTATION
  // numbers for up to a minute after an add/edit/delete, defeating the
  // client-side cache busting (see refreshSpendingCaches). Freshness after
  // a mutation beats saving those queries.
  routeRules: {
    '/proxy/rates': { proxy: 'https://api.frankfurter.app/latest' }
  },

  // Global stylesheet — loaded on every page. This is where Tailwind's base
  // layers and our small set of reusable component classes live.
  css: ['~/assets/css/main.css'],

  // Everything inside <head>. We set the tab title, viewport (for mobile),
  // and a description. Fonts are self-hosted via @nuxt/fonts (above), so no
  // stylesheet links live here anymore.
  app: {
    // Route transitions (ROADMAP §2): every page swap fades + drifts through
    // the .page-* classes in main.css. out-in so the old page clears before
    // the new one enters — no mid-air overlap. The global reduced-motion rule
    // in main.css zeroes the durations, so this is a no-op for those users.
    pageTransition: { name: 'page', mode: 'out-in' },
    head: {
      title: 'Vaulted — Secure Today. Empower Tomorrow.',
      htmlAttrs: { lang: 'en' },
      meta: [
        { charset: 'utf-8' },
        // viewport-fit=cover lets the app paint under the notch/home bar so
        // the env(safe-area-inset-*) offsets (dock, header) have real values.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        // Zinc-950 — matches the manifest theme_color so the installed app's
        // title bar / status bar blends with the dark shell.
        { name: 'theme-color', content: '#09090B' },
        // iOS standalone mode (Safari ignores the manifest's display field).
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
        { name: 'apple-mobile-web-app-title', content: 'Vaulted' },
        {
          name: 'description',
          content:
            'Vaulted — a clean, focused view of your spending. Secure Today. Empower Tomorrow.'
        }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // PWA install surface: manifest + a placeholder touch icon (iOS wants
        // PNG ideally — swap alongside the /icons placeholders later).
        { rel: 'manifest', href: '/manifest.webmanifest' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' }
      ],
      // Applies the saved theme before first paint so a light-mode user never
      // sees a dark flash (and vice versa). Must run inline in <head> —
      // anything later flickers. Defaults to dark when nothing is saved.
      script: [
        {
          innerHTML:
            "(function(){try{var t=localStorage.getItem('vaulted-theme');document.documentElement.classList.toggle('dark',t?t==='dark':true)}catch(e){document.documentElement.classList.add('dark')}})()"
        }
      ]
    }
  }
})
