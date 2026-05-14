<script setup lang="ts">
const { user, roles, isAdmin, logout } = useAuth()

const initials = computed(() => {
  const name = user.value?.displayName || user.value?.email || '?'
  return name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('')
})

const items = computed(() => {
  const out: { label: string, icon?: string, to?: string, onSelect?: () => void, slot?: 'header' }[][] = []

  out.push([
    {
      slot: 'header',
      label: user.value?.displayName ?? user.value?.email ?? '',
    },
  ])

  if (isAdmin.value) {
    out.push([
      { label: 'Admin', icon: 'i-lucide-settings', to: '/admin/projects' },
    ])
  }

  out.push([
    { label: 'Esci', icon: 'i-lucide-log-out', onSelect: logout },
  ])

  return out
})
</script>

<template>
  <UDropdownMenu
    :items="items"
    :ui="{ content: 'w-64' }"
    :content="{ align: 'end', sideOffset: 6 }"
  >
    <button
      type="button"
      class="size-9 rounded-full bg-[var(--ui-bg-elevated)] text-[var(--ui-text-highlighted)] text-xs font-semibold ring-1 ring-[var(--ui-border)] hover:ring-[var(--ui-border-accented)] transition-all flex items-center justify-center tracking-wide"
      :aria-label="user?.displayName ?? user?.email ?? 'Utente'"
    >
      {{ initials }}
    </button>

    <template #header>
      <div class="px-2.5 py-2 -m-1 mb-1 border-b border-[var(--ui-border)]">
        <p class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate">
          {{ user?.displayName ?? user?.email }}
        </p>
        <p v-if="user?.displayName" class="text-xs text-[var(--ui-text-muted)] truncate">
          {{ user.email }}
        </p>
        <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-dimmed)] mt-1">
          {{ roles.join(' · ') }}
        </p>
      </div>
    </template>
  </UDropdownMenu>
</template>
