<script setup lang="ts">
// Standalone auth page — email + password, toggling between sign in and sign
// up. No app chrome (dock/header), so layout: false. Matches the app's dark
// canvas (#09090B = zinc-950) and the paper-grain texture from the shell.
//
// Polish (ROADMAP §1): mode crossfade, error shake, password visibility
// toggle, and spinner button states.
//
// Signup hardening (NIST SP 800-63B): min length 8, NO composition rules
// (length beats forced symbols), confirm-password match, paste allowed,
// standard autocomplete hints for password managers, and a length-weighted
// strength meter that nudges toward passphrases. Passwords go straight from
// the browser to Supabase GoTrue — no Nitro route ever sees them — so the
// Zod policy lives here and the server-side floor is Supabase Auth's own
// minimum-password-length setting (keep it at 8 in the dashboard).
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { z } from 'zod'

definePageMeta({ layout: false })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const notice = ref('')

// NIST SP 800-63B: verifiers SHALL require at least 8 characters and SHOULD
// NOT impose composition rules. 72 is bcrypt's byte ceiling (GoTrue hashes
// with bcrypt), so longer input would be silently truncated — reject instead.
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

const signupSchema = z
  .object({
    email: z.email('Enter a valid email address.'),
    password: z
      .string()
      .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters — a longer passphrase beats symbols.`)
      .max(PASSWORD_MAX, `Keep it under ${PASSWORD_MAX} characters.`),
    confirm: z.string()
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match.",
    path: ['confirm']
  })

// Strength estimate, signup only. Length-weighted entropy: bits ≈ length ×
// log2(charset breadth). Charset variety helps but never gates — a 20-char
// lowercase passphrase (~94 bits) outranks "P@ssw0rd" (~52 bits), which is
// exactly the incentive NIST wants. Deliberately lightweight; no dictionary.
const strength = computed(() => {
  const pw = password.value
  if (!pw) return null
  let charset = 0
  if (/[a-z]/.test(pw)) charset += 26
  if (/[A-Z]/.test(pw)) charset += 26
  if (/\d/.test(pw)) charset += 10
  if (/[^a-zA-Z0-9]/.test(pw)) charset += 33
  const bits = pw.length * Math.log2(charset || 1)
  const pct = Math.min(100, Math.round((bits / 90) * 100))
  if (pw.length < PASSWORD_MIN || bits < 40)
    return { pct, label: 'Weak', bar: 'bg-red-500', text: 'text-red-500' }
  if (bits < 60) return { pct, label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-500' }
  if (bits < 80) return { pct, label: 'Good', bar: 'bg-lime-500', text: 'text-lime-600' }
  return { pct, label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-500' }
})

// Error shake: flipped on when a submit fails, off again on animationend so
// the same error can shake twice. nextTick gap forces the CSS restart.
const shaking = ref(false)
async function triggerShake() {
  shaking.value = false
  await nextTick()
  shaking.value = true
}

// Once a session exists (fresh login, or arriving already signed in), leave.
watch(user, () => { if (user.value) navigateTo('/') }, { immediate: true })

function switchMode() {
  mode.value = mode.value === 'signin' ? 'signup' : 'signin'
  error.value = ''
  notice.value = ''
  confirm.value = ''
  showPassword.value = false
}

async function submit() {
  error.value = ''
  notice.value = ''

  // Client-side policy gate for signup. Sign-in stays permissive: whatever
  // the account was created with must remain enterable.
  if (mode.value === 'signup') {
    const parsed = signupSchema.safeParse({
      email: email.value,
      password: password.value,
      confirm: confirm.value
    })
    if (!parsed.success) {
      error.value = parsed.error.issues[0]?.message ?? 'Check the form and try again.'
      void triggerShake()
      return
    }
  }

  loading.value = true
  try {
    if (mode.value === 'signup') {
      const { data, error: e } = await supabase.auth.signUp({
        email: email.value,
        password: password.value
      })
      // Existing email surfaces two ways depending on the project's "Confirm
      // email" setting: OFF → GoTrue errors with "User already registered";
      // ON → NO error, but an obfuscated fake user with an EMPTY identities
      // array (anti-enumeration). Both must land on the same friendly error.
      const EMAIL_TAKEN = 'This email is already in use. Please sign in instead.'
      if (e) throw /already registered/i.test(e.message) ? new Error(EMAIL_TAKEN) : e
      if (data.user && data.user.identities?.length === 0) throw new Error(EMAIL_TAKEN)
      // If "Confirm email" is ON in Supabase, no session exists yet — the user
      // must click the emailed link (lands on /confirm). If it's OFF, a session
      // is created now and the watcher above redirects.
      notice.value = 'Account created. Check your email to confirm, then sign in.'
      mode.value = 'signin'
      confirm.value = ''
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({
        email: email.value,
        password: password.value
      })
      if (e) throw e
      // watch(user) handles the redirect on success.
    }
  } catch (e) {
    error.value =
      (e as { message?: string })?.message ?? 'Something went wrong. Please try again.'
    void triggerShake()
  } finally {
    loading.value = false
  }
}
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
      <div class="glass-card p-8" :class="shaking && 'shake'" @animationend="shaking = false">
        <!-- Brand mark: the Vaulted shield, matching the header logo. -->
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

        <!-- Mode crossfade: out-in so the old heading clears before the new
             one rises in. Keyed on mode. -->
        <Transition name="xfade" mode="out-in">
          <div :key="mode">
            <p class="eyebrow mb-1">{{ mode === 'signin' ? 'Welcome back' : 'Create your vault' }}</p>
            <h1 class="mb-6 text-xl font-bold text-ink">
              {{ mode === 'signin' ? 'Sign in to continue' : 'Start tracking securely' }}
            </h1>
          </div>
        </Transition>

        <form class="space-y-4" novalidate @submit.prevent="submit">
          <div>
            <label for="email" class="label">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              class="field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="label">Password</label>
            <div class="relative">
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                required
                :minlength="mode === 'signup' ? PASSWORD_MIN : undefined"
                :maxlength="PASSWORD_MAX"
                :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
                class="field pr-11"
                placeholder="••••••••"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-ink-faint transition-colors duration-200 hover:text-ink"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :aria-pressed="showPassword"
                @click="showPassword = !showPassword"
              >
                <component :is="showPassword ? EyeOff : Eye" class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <!-- Strength meter (signup only): fills + recolors as entropy
                 grows. Length is the main lever — matches the min-8-no-rules
                 policy above. -->
            <div v-if="mode === 'signup' && strength" class="mt-2">
              <div
                class="h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
                role="meter"
                aria-label="Password strength"
                :aria-valuenow="strength.pct"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuetext="strength.label"
              >
                <div
                  class="h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
                  :class="strength.bar"
                  :style="{ width: `${strength.pct}%` }"
                />
              </div>
              <p class="mt-1 flex items-baseline justify-between text-[0.68rem]">
                <span class="text-ink-faint">Longer is stronger — try a passphrase.</span>
                <span class="font-medium" :class="strength.text">{{ strength.label }}</span>
              </p>
            </div>
          </div>

          <!-- Confirm password: signup only, fades in with the mode switch. -->
          <Transition name="xfade">
            <div v-if="mode === 'signup'">
              <label for="confirm-password" class="label">Confirm password</label>
              <input
                id="confirm-password"
                v-model="confirm"
                :type="showPassword ? 'text' : 'password'"
                required
                :maxlength="PASSWORD_MAX"
                autocomplete="new-password"
                class="field"
                :class="confirm && confirm !== password && 'field-invalid'"
                placeholder="••••••••"
              />
            </div>
          </Transition>

          <p v-if="error" class="text-xs text-negative" role="alert">{{ error }}</p>
          <p v-if="notice" class="text-xs text-positive" role="status">{{ notice }}</p>

          <button type="submit" class="btn btn-primary w-full" :disabled="loading">
            <Loader2
              v-if="loading"
              class="h-4 w-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <span>
              {{
                loading
                  ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                  : mode === 'signin' ? 'Sign in' : 'Sign up'
              }}
            </span>
          </button>
        </form>

        <div class="hairline my-6" />

        <button
          type="button"
          class="w-full text-center text-xs text-ink-faint transition-colors hover:text-ink"
          @click="switchMode()"
        >
          <Transition name="xfade" mode="out-in">
            <span :key="mode">
              {{ mode === 'signin' ? 'No account yet? Create one' : 'Already have an account? Sign in' }}
            </span>
          </Transition>
        </button>
      </div>

      <p class="mt-6 text-center font-mono text-xs text-ink-faint">
        Vaulted · Secure Today. Empower Tomorrow.
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Mode crossfade: quick fade + small vertical drift. */
.xfade-enter-active,
.xfade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.xfade-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.xfade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Error shake on the card — physical "no". */
@keyframes shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-4px); }
  40%, 60% { transform: translateX(4px); }
}
.shake {
  animation: shake 0.45s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
}

@media (prefers-reduced-motion: reduce) {
  .xfade-enter-active,
  .xfade-leave-active {
    transition: none;
  }
  .shake {
    animation: none;
  }
}
</style>
