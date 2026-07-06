<script setup lang="ts">
// The default layout wraps every page: the top header, the page content, a
// quiet footer, and the toast host. A page's markup is rendered where <slot />
// sits. Because it's named "default", every page uses it automatically.
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader />

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
      <slot />
    </main>

    <footer class="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
      <div class="border-t border-edge pt-4 text-center">
        <p class="font-mono text-xs text-ink-soft">
          Ledger · personal finance, kept in order
        </p>
      </div>
    </footer>

    <!-- Toast notifications render here, on top of everything. -->
    <AppToasts />
  </div>
</template>
