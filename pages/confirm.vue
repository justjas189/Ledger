<script setup lang="ts">
// Auth callback landing (redirectOptions.callback). The Supabase module
// processes the email-confirmation / OAuth code on load and populates the
// session; once the user is present we send them into the app.
//
// Polish (ROADMAP §1): same glass card + brand mark as login.vue, a spinner
// while the session settles, an error state for dead links (Supabase reports
// failures in the URL hash, e.g. expired confirmation links), and an escape
// hatch back to /login when confirmation stalls.
import { Loader2, TriangleAlert } from 'lucide-vue-next'

definePageMeta({ layout: false })

const user = useSupabaseUser()
watch(user, () => { if (user.value) navigateTo('/') }, { immediate: true })

const error = ref('')
const slow = ref(false)
let slowTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  // Failed links come back as #error=...&error_description=... in the hash.
  const hash = new URLSearchParams(window.location.hash.slice(1))
  error.value = hash.get('error_description') ?? ''
  // Still no session after a while and no explicit error: offer a way out.
  slowTimer = setTimeout(() => { slow.value = true }, 6000)
})
onBeforeUnmount(() => clearTimeout(slowTimer))
</script>

<template>
  <div
    class="relative grid min-h-screen place-items-center overflow-hidden bg-stone-50 px-4 text-ink dark:bg-zinc-950"
  >
    <!-- Same paper-grain texture as the app shell (layouts/default.vue). -->
    <div
      class="pointer-events-none fixed inset-0 -z-10 opacity-[0.13] dark:opacity-[0.06]"
      aria-hidden="true"
      style="background-image: url(&quot;data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E&quot;)"
    />

    <div class="w-full max-w-sm animate-rise">
      <div class="glass-card p-8">
        <!-- Brand mark: the Vaulted shield, matching login.vue. -->
        <div class="mb-6 flex items-center gap-2.5">
          <svg viewBox="0 0 100 100" class="h-9 w-9" role="img" aria-label="Vaulted">
            <path d="M 25 28 Q 50 8 75 28" stroke="#00A859" stroke-width="7" stroke-linecap="round" fill="none" />
            <path
              d="M 12 32 C 12 65 30 90 50 98 C 70 90 88 65 88 32 L 74 36 C 70 60 60 80 50 86 C 40 80 30 60 26 36 Z"
              fill="#00A859"
            />
            <circle cx="50" cy="52" r="12" stroke="#00A859" stroke-width="4" fill="none" />
            <circle cx="50" cy="52" r="4" fill="#00A859" />
          </svg>
          <span class="text-lg font-extrabold tracking-tight text-ink">Vaulted</span>
        </div>

        <!-- Error: dead/expired link reported in the URL hash. -->
        <template v-if="error">
          <p class="eyebrow mb-1">Confirmation failed</p>
          <h1 class="mb-3 text-xl font-bold text-ink">That link didn't work</h1>
          <p class="mb-6 flex items-start gap-2 text-xs text-negative" role="alert">
            <TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {{ error }}
          </p>
          <NuxtLink to="/login" class="btn btn-primary w-full">Back to sign in</NuxtLink>
        </template>

        <!-- Normal path: the Supabase client is exchanging the code. -->
        <template v-else>
          <p class="eyebrow mb-1">Almost there</p>
          <h1 class="mb-6 text-xl font-bold text-ink">Confirming your session</h1>
          <p class="flex items-center gap-2.5 text-sm text-ink-soft" role="status">
            <Loader2
              class="h-4 w-4 animate-spin text-positive motion-reduce:animate-none"
              aria-hidden="true"
            />
            Verifying your email…
          </p>

          <template v-if="slow">
            <div class="hairline my-6" />
            <p class="text-xs text-ink-faint">
              Taking longer than expected?
              <NuxtLink to="/login" class="text-ink underline-offset-2 hover:underline">
                Back to sign in
              </NuxtLink>
            </p>
          </template>
        </template>
      </div>

      <p class="mt-6 text-center font-mono text-xs text-ink-faint">
        Vaulted · Secure Today. Empower Tomorrow.
      </p>
    </div>
  </div>
</template>
