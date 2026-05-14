<script setup lang="ts">
definePageMeta({
  middleware: ['admin-only'],
  layout: 'admin',
})

// Redirect alla prima sezione: commesse
await navigateTo('/admin/projects', { replace: true })
</script>

<template>
  <div />
</template>
