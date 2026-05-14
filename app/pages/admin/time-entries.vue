<script setup lang="ts">
definePageMeta({
  middleware: ['admin-only'],
  layout: 'admin',
})

useHead({ title: 'Ore · Admin' })

interface EntryRow {
  id: string
  date: string
  startTime: string | null
  endTime: string | null
  durationMinutes: number
  comment: string | null
  source: 'manual' | 'imported' | 'outlook'
  user: { id: string, displayName: string, email: string }
  project: { id: string, code: string, name: string, color: string } | null
  leaveType: { id: string, code: string, name: string, color: string } | null
}

interface UserOption {
  id: string
  displayName: string
  email: string
}

interface ProjectOption {
  id: string
  code: string
  name: string
  color: string
}

/* ----------------------------- Filtri ----------------------------- */

function defaultFrom(): string {
  const d = new Date()
  d.setDate(d.getDate() - 90)
  return d.toISOString().slice(0, 10)
}
function defaultTo(): string {
  return new Date().toISOString().slice(0, 10)
}

const from = ref(defaultFrom())
const to = ref(defaultTo())
const selectedUserIds = ref<string[]>([])
const selectedProjectIds = ref<string[]>([])

/* ----------------------------- Data ----------------------------- */

const query = computed(() => {
  const q: Record<string, unknown> = { from: from.value, to: to.value }
  if (selectedUserIds.value.length) q.userId = selectedUserIds.value
  if (selectedProjectIds.value.length) q.projectId = selectedProjectIds.value
  return q
})

const { data: entries, status } = await useFetch<EntryRow[]>('/api/admin/time-entries', {
  query,
  default: () => [],
})

const { data: usersList } = await useFetch<UserOption[]>('/api/admin/users', {
  default: () => [],
})
const { data: projectsList } = await useFetch<ProjectOption[]>('/api/admin/projects', {
  default: () => [],
})

/* ----------------------------- Stats ----------------------------- */

const stats = computed(() => {
  const list = entries.value ?? []
  const totalMin = list.reduce((acc, e) => acc + e.durationMinutes, 0)
  const employees = new Set(list.map((e) => e.user.id))
  const projectCodes = new Set(list.filter((e) => e.project).map((e) => e.project!.code))
  return {
    rows: list.length,
    totalHours: totalMin / 60,
    employees: employees.size,
    projects: projectCodes.size,
  }
})

/* ----------------------------- Format ----------------------------- */

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}
function formatTime(t: string | null) {
  if (!t) return null
  return t.slice(0, 5)
}
function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function formatHours(h: number) {
  return h.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const userOptions = computed(() =>
  (usersList.value ?? []).map((u) => ({ label: u.displayName, value: u.id })),
)
const projectOptions = computed(() =>
  (projectsList.value ?? []).map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id })),
)

function resetFilters() {
  from.value = defaultFrom()
  to.value = defaultTo()
  selectedUserIds.value = []
  selectedProjectIds.value = []
}
</script>

<template>
  <div class="px-8 py-8 space-y-8 max-w-7xl">
    <header class="space-y-1">
      <p class="text-[11px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
        Reportistica
      </p>
      <h1 class="text-2xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">
        Ore inserite
      </h1>
      <p class="text-sm text-[var(--ui-text-muted)] max-w-2xl leading-relaxed">
        Vista read-only di tutti i blocchi orari registrati. Filtra per
        dipendente, commessa o periodo. Le righe contrassegnate
        <span class="font-mono text-[10px] px-1 py-0.5 rounded bg-[var(--ui-bg-elevated)]">imported</span>
        provengono da import del gestionale e non sono modificabili da qui.
      </p>
    </header>

    <!-- Stats strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-4">
        <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">
          Righe
        </p>
        <p class="text-2xl font-semibold tabular-nums tracking-tight mt-1 text-[var(--ui-text-highlighted)]">
          {{ stats.rows.toLocaleString('it-IT') }}
        </p>
      </div>
      <div class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-4">
        <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">
          Ore totali
        </p>
        <p class="text-2xl font-semibold tabular-nums tracking-tight mt-1 text-[var(--ui-text-highlighted)]">
          {{ formatHours(stats.totalHours) }}
        </p>
      </div>
      <div class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-4">
        <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">
          Dipendenti
        </p>
        <p class="text-2xl font-semibold tabular-nums tracking-tight mt-1 text-[var(--ui-text-highlighted)]">
          {{ stats.employees }}
        </p>
      </div>
      <div class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-4">
        <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)]">
          Commesse
        </p>
        <p class="text-2xl font-semibold tabular-nums tracking-tight mt-1 text-[var(--ui-text-highlighted)]">
          {{ stats.projects }}
        </p>
      </div>
    </div>

    <!-- Filters -->
    <div class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xs uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
          Filtri
        </h2>
        <UButton variant="ghost" size="xs" color="neutral" @click="resetFilters">
          Reset
        </UButton>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <UFormField label="Da" size="sm">
          <UInput v-model="from" type="date" class="w-full" />
        </UFormField>
        <UFormField label="A" size="sm">
          <UInput v-model="to" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Dipendenti" size="sm">
          <USelectMenu
            v-model="selectedUserIds"
            :items="userOptions"
            multiple
            value-key="value"
            placeholder="Tutti"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Commesse" size="sm">
          <USelectMenu
            v-model="selectedProjectIds"
            :items="projectOptions"
            multiple
            value-key="value"
            placeholder="Tutte"
            class="w-full"
          />
        </UFormField>
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-xl ring-1 ring-[var(--ui-border)] overflow-hidden bg-[var(--ui-bg)]">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs uppercase tracking-wider text-[var(--ui-text-muted)] bg-[var(--ui-bg-elevated)]">
            <th class="px-5 py-3 font-medium">
              Data
            </th>
            <th class="px-3 py-3 font-medium">
              Dipendente
            </th>
            <th class="px-3 py-3 font-medium">
              Commessa
            </th>
            <th class="px-3 py-3 font-medium text-right">
              Inizio
            </th>
            <th class="px-3 py-3 font-medium text-right">
              Fine
            </th>
            <th class="px-3 py-3 font-medium text-right">
              Durata
            </th>
            <th class="px-3 py-3 font-medium">
              Origine
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending' && (entries?.length ?? 0) === 0">
            <td colspan="7" class="px-5 py-12 text-center text-sm text-[var(--ui-text-muted)]">
              Caricamento…
            </td>
          </tr>
          <tr v-else-if="(entries?.length ?? 0) === 0">
            <td colspan="7" class="px-5 py-16 text-center text-sm text-[var(--ui-text-muted)]">
              Nessun risultato con i filtri correnti.
            </td>
          </tr>
          <tr
            v-for="e in entries ?? []"
            :key="e.id"
            class="border-t border-[var(--ui-border)] hover:bg-[var(--ui-bg-elevated)]/60 transition-colors"
          >
            <td class="px-5 py-3 tabular-nums text-[var(--ui-text-highlighted)] whitespace-nowrap">
              {{ formatDate(e.date) }}
            </td>
            <td class="px-3 py-3 text-[var(--ui-text-highlighted)]">
              {{ e.user.displayName }}
            </td>
            <td class="px-3 py-3">
              <div v-if="e.project" class="flex items-center gap-2 min-w-0">
                <span
                  class="size-2.5 rounded-full shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  :style="{ background: e.project.color }"
                />
                <div class="min-w-0">
                  <p class="text-xs font-mono text-[var(--ui-text-muted)] tabular-nums">
                    {{ e.project.code }}
                  </p>
                  <p class="text-sm text-[var(--ui-text-highlighted)] truncate">
                    {{ e.project.name }}
                  </p>
                </div>
              </div>
              <div v-else-if="e.leaveType" class="flex items-center gap-2">
                <span
                  class="size-2.5 rounded-full shrink-0 ring-1 ring-black/5 dark:ring-white/10"
                  :style="{ background: e.leaveType.color }"
                />
                <span class="text-sm font-medium" :style="{ color: e.leaveType.color }">
                  {{ e.leaveType.name }}
                </span>
              </div>
            </td>
            <td class="px-3 py-3 text-right tabular-nums text-[var(--ui-text-muted)] font-mono text-xs">
              {{ formatTime(e.startTime) ?? '—' }}
            </td>
            <td class="px-3 py-3 text-right tabular-nums text-[var(--ui-text-muted)] font-mono text-xs">
              {{ formatTime(e.endTime) ?? '—' }}
            </td>
            <td class="px-3 py-3 text-right tabular-nums text-[var(--ui-text-highlighted)] font-mono font-medium">
              {{ formatDuration(e.durationMinutes) }}
            </td>
            <td class="px-3 py-3">
              <span
                class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider font-mono"
                :class="{
                  'bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)]': e.source === 'imported',
                  'bg-[var(--ui-color-success-50)] text-[var(--ui-color-success-700)] dark:bg-[var(--ui-color-success-950)] dark:text-[var(--ui-color-success-400)]': e.source === 'manual',
                  'bg-[var(--ui-color-info-50)] text-[var(--ui-color-info-700)] dark:bg-[var(--ui-color-info-950)] dark:text-[var(--ui-color-info-400)]': e.source === 'outlook',
                }"
              >
                {{ e.source }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="(entries?.length ?? 0) >= 500" class="text-xs text-[var(--ui-text-dimmed)] text-center">
      Mostrando le prime 500 righe. Restringi i filtri per vederne meno o paginare.
    </p>
  </div>
</template>
