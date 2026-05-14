<script setup lang="ts">
const { user, logout } = useAuth()

const sections = [
  { to: '/admin/projects', label: 'Commesse', icon: 'i-lucide-briefcase' },
  { to: '/admin/holidays', label: 'Festività', icon: 'i-lucide-calendar-days' },
  { to: '/admin/leave-types', label: 'Tipi orario', icon: 'i-lucide-clock-3' },
]
</script>

<template>
  <div class="min-h-screen flex bg-[var(--ui-bg)] text-[var(--ui-text)]">
    <aside
      class="w-64 shrink-0 border-r border-[var(--ui-border)] flex flex-col"
    >
      <div class="px-5 py-5 border-b border-[var(--ui-border)]">
        <NuxtLink to="/" class="block group">
          <p class="text-[10px] uppercase tracking-[0.22em] text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text)] transition-colors">
            Thetis · Time Report
          </p>
          <p class="mt-1 text-sm font-medium text-[var(--ui-text-highlighted)]">
            Admin
          </p>
        </NuxtLink>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-0.5">
        <NuxtLink
          v-for="s in sections"
          :key="s.to"
          :to="s.to"
          class="group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150"
          active-class="!bg-[var(--ui-bg-elevated)] !text-[var(--ui-text-highlighted)] ring-1 ring-[var(--ui-border)]"
          :class="[
            'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-bg-elevated)]',
          ]"
        >
          <UIcon :name="s.icon" class="size-4 shrink-0 opacity-80 group-hover:opacity-100" />
          {{ s.label }}
        </NuxtLink>
      </nav>

      <div class="px-3 py-3 border-t border-[var(--ui-border)] space-y-2">
        <div class="px-2 py-1.5">
          <p class="text-xs text-[var(--ui-text-muted)] truncate">
            {{ user?.displayName ?? user?.email }}
          </p>
          <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-dimmed)] mt-0.5">
            {{ user?.roles?.join(' · ') }}
          </p>
        </div>
        <UButton
          variant="ghost"
          color="neutral"
          size="sm"
          icon="i-lucide-log-out"
          block
          @click="logout"
        >
          Esci
        </UButton>
      </div>
    </aside>

    <main class="flex-1 overflow-x-hidden">
      <slot />
    </main>
  </div>
</template>
