<script setup lang="ts">
useHead({ title: 'Thetis · Time Report' })

const { user, isAdmin, isManager } = useAuth()

interface SummaryResponse {
  weekMinutes: number
  monthMinutes: number
  last30Minutes: number
  topProjects: Array<{
    id: string
    code: string
    name: string
    color: string
    minutes: number
  }>
}

const { data: summary } = await useFetch<SummaryResponse>('/api/me/summary', {
  default: () => ({ weekMinutes: 0, monthMinutes: 0, last30Minutes: 0, topProjects: [] }),
})

const firstName = computed(() => {
  const name = user.value?.displayName ?? ''
  return name.split(/\s+/)[0] ?? ''
})

function greet() {
  const h = new Date().getHours()
  if (h < 5) return 'Notte'
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

function fmtHours(min: number): string {
  const h = min / 60
  return h.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function fmtPct(min: number, total: number): string {
  if (!total) return '0%'
  return `${Math.round((min / total) * 100)}%`
}

const topProjectsTotal = computed(() =>
  (summary.value?.topProjects ?? []).reduce((acc, p) => acc + p.minutes, 0),
)

const monthLabel = computed(() => {
  const d = new Date()
  return d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
})
</script>

<template>
  <div class="min-h-screen bg-[var(--ui-bg)] text-[var(--ui-text)]">
    <div class="max-w-5xl mx-auto px-6 sm:px-10 py-12 sm:py-16 space-y-12">
      <!-- Hero -->
      <header class="space-y-2">
        <p class="text-[11px] uppercase tracking-[0.22em] text-[var(--ui-text-muted)]">
          Thetis · Time Report
        </p>
        <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-[var(--ui-text-highlighted)]">
          {{ greet() }}, {{ firstName }}.
        </h1>
        <p class="text-sm sm:text-base text-[var(--ui-text-muted)] max-w-xl leading-relaxed">
          Da qui registri il tuo tempo e tieni d'occhio l'andamento di {{ monthLabel }}.
        </p>
      </header>

      <!-- KPI strip -->
      <section class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-5 transition-colors hover:ring-[var(--ui-border-accented)]">
          <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
            Questa settimana
          </p>
          <p class="mt-2 flex items-baseline gap-1.5">
            <span class="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ui-text-highlighted)]">
              {{ fmtHours(summary?.weekMinutes ?? 0) }}
            </span>
            <span class="text-sm text-[var(--ui-text-muted)]">ore</span>
          </p>
        </div>

        <div class="rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-5 transition-colors hover:ring-[var(--ui-border-accented)]">
          <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
            Questo mese
          </p>
          <p class="mt-2 flex items-baseline gap-1.5">
            <span class="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ui-text-highlighted)]">
              {{ fmtHours(summary?.monthMinutes ?? 0) }}
            </span>
            <span class="text-sm text-[var(--ui-text-muted)]">ore</span>
          </p>
        </div>

        <div class="rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-5 transition-colors hover:ring-[var(--ui-border-accented)]">
          <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
            Ultimi 30 giorni
          </p>
          <p class="mt-2 flex items-baseline gap-1.5">
            <span class="text-3xl font-semibold tabular-nums tracking-tight text-[var(--ui-text-highlighted)]">
              {{ fmtHours(summary?.last30Minutes ?? 0) }}
            </span>
            <span class="text-sm text-[var(--ui-text-muted)]">ore</span>
          </p>
        </div>
      </section>

      <!-- Quick actions -->
      <section class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          aria-disabled="true"
          class="group relative rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-6 opacity-70 cursor-not-allowed"
        >
          <div class="flex items-start gap-4">
            <div class="size-10 rounded-xl bg-[var(--ui-bg-elevated)] grid place-items-center text-[var(--ui-text-muted)] ring-1 ring-[var(--ui-border)]">
              <UIcon name="i-lucide-clock-3" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
                  Inserisci le tue ore
                </p>
                <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)] ring-1 ring-[var(--ui-border)]">
                  In arrivo
                </span>
              </div>
              <p class="text-xs text-[var(--ui-text-muted)] mt-1 leading-relaxed">
                Registra i blocchi di lavoro per commessa, ferie, permessi.
                Con pre-fill dal calendario Outlook quando l'SSO Microsoft è attivo.
              </p>
            </div>
          </div>
        </div>

        <NuxtLink
          v-if="isAdmin"
          to="/admin/projects"
          class="group relative rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-6 transition-all hover:ring-[var(--ui-border-accented)] hover:-translate-y-0.5 duration-200"
        >
          <div class="flex items-start gap-4">
            <div class="size-10 rounded-xl grid place-items-center ring-1 ring-[color-mix(in_oklch,var(--color-brand-500)_30%,transparent)] text-[var(--color-brand-500)] bg-[color-mix(in_oklch,var(--color-brand-500)_8%,transparent)]">
              <UIcon name="i-lucide-settings-2" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
                Pannello admin
              </p>
              <p class="text-xs text-[var(--ui-text-muted)] mt-1 leading-relaxed">
                Anagrafiche commesse, festività, tipi orario e vista completa delle ore.
              </p>
            </div>
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-4 text-[var(--ui-text-muted)] group-hover:text-[var(--ui-text-highlighted)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
            />
          </div>
        </NuxtLink>

        <div
          v-else-if="isManager"
          aria-disabled="true"
          class="group relative rounded-2xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-6 opacity-70 cursor-not-allowed"
        >
          <div class="flex items-start gap-4">
            <div class="size-10 rounded-xl bg-[var(--ui-bg-elevated)] grid place-items-center text-[var(--ui-text-muted)] ring-1 ring-[var(--ui-border)]">
              <UIcon name="i-lucide-users-round" class="size-5" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="text-sm font-semibold text-[var(--ui-text-highlighted)]">
                  Il tuo team
                </p>
                <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--ui-bg-elevated)] text-[var(--ui-text-muted)] ring-1 ring-[var(--ui-border)]">
                  In arrivo
                </span>
              </div>
              <p class="text-xs text-[var(--ui-text-muted)] mt-1 leading-relaxed">
                Ore inserite dal team, richieste di ferie e permessi da approvare.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Top projects -->
      <section v-if="summary && summary.topProjects.length > 0" class="space-y-4">
        <div class="flex items-end justify-between">
          <div>
            <p class="text-[10px] uppercase tracking-[0.18em] text-[var(--ui-text-muted)]">
              Dove sta andando il tuo tempo
            </p>
            <h2 class="text-lg font-semibold tracking-tight text-[var(--ui-text-highlighted)] mt-1">
              Top commesse · ultimi 30 giorni
            </h2>
          </div>
          <p class="text-xs text-[var(--ui-text-dimmed)] tabular-nums">
            {{ fmtHours(topProjectsTotal) }} ore totali
          </p>
        </div>

        <ul class="space-y-2">
          <li
            v-for="p in summary.topProjects"
            :key="p.id"
            class="rounded-xl ring-1 ring-[var(--ui-border)] bg-[var(--ui-bg)] px-5 py-3.5 flex items-center gap-4"
          >
            <span
              class="size-2.5 rounded-full shrink-0 ring-1 ring-black/5 dark:ring-white/10"
              :style="{ background: p.color }"
            />
            <div class="min-w-0 flex-1">
              <p class="text-xs font-mono text-[var(--ui-text-muted)] tabular-nums">
                {{ p.code }}
              </p>
              <p class="text-sm font-medium text-[var(--ui-text-highlighted)] truncate">
                {{ p.name }}
              </p>
            </div>
            <div class="text-right shrink-0">
              <p class="text-sm font-semibold tabular-nums text-[var(--ui-text-highlighted)]">
                {{ fmtHours(p.minutes) }}h
              </p>
              <p class="text-[10px] uppercase tracking-wider text-[var(--ui-text-muted)] tabular-nums">
                {{ fmtPct(p.minutes, topProjectsTotal) }}
              </p>
            </div>
            <!-- visual share bar -->
            <div class="hidden sm:block w-32 shrink-0">
              <div class="h-1.5 rounded-full bg-[var(--ui-bg-elevated)] overflow-hidden">
                <div
                  class="h-full transition-[width] duration-500 ease-out"
                  :style="{
                    width: `${(p.minutes / topProjectsTotal) * 100}%`,
                    background: p.color,
                  }"
                />
              </div>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-else
        class="rounded-2xl ring-1 ring-dashed ring-[var(--ui-border)] bg-[var(--ui-bg)] px-6 py-12 text-center"
      >
        <UIcon name="i-lucide-hourglass" class="size-8 mx-auto text-[var(--ui-text-dimmed)]" />
        <p class="mt-3 text-sm font-medium text-[var(--ui-text-highlighted)]">
          Nessuna ora negli ultimi 30 giorni
        </p>
        <p class="mt-1 text-xs text-[var(--ui-text-muted)]">
          Inizia a registrarne appena la pagina di inserimento è pronta.
        </p>
      </section>
    </div>
  </div>
</template>
