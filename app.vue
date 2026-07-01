<script setup lang="ts">
// app.vue is the single root component Nuxt renders.
// <NuxtLayout> pulls in layouts/default.vue (our header + page shell), and
// <NuxtPage> renders whichever page matches the current URL (from /pages).
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
