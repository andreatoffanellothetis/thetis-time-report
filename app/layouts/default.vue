<script setup lang="ts">
const { loggedIn } = useAuth()
</script>

<template>
  <div class="relative">
    <slot />

    <!-- Floating user menu, sempre visibile sul default layout -->
    <div
      v-if="loggedIn"
      class="fixed top-4 right-4 z-50"
    >
      <UserMenu />
    </div>
  </div>
</template>
