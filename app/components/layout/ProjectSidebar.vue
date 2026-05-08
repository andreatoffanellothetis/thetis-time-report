<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { formatHoursIt } from '~/utils/minutes'
import type { Project } from '~/types/domain'

const datasetStore = useDatasetStore()

interface ProjectStat {
  project: Project
  totalMin: number
  employeesCount: number
  daysCount: number
}

const sortBy = ref<'hours' | 'name' | 'code'>('hours')
const query = ref('')

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const allStats = computed<ProjectStat[]>(() => {
  const ds = datasetStore.dataset
  if (!ds) return []

  const totals = new Map<string, { totalMin: number, employees: Set<string>, days: Set<string> }>()
  for (const p of ds.projects) {
    totals.set(p.id, { totalMin: 0, employees: new Set(), days: new Set() })
  }

  for (const e of ds.employees) {
    for (const day of e.daily.values()) {
      for (const entry of day.entries) {
        const acc = totals.get(entry.project.id)
        if (!acc) continue
        acc.totalMin += entry.durationMin
        acc.employees.add(e.id)
        acc.days.add(day.isoDate)
      }
    }
  }

  return ds.projects.map(p => {
    const t = totals.get(p.id)!
    return {
      project: p,
      totalMin: t.totalMin,
      employeesCount: t.employees.size,
      daysCount: t.days.size,
    }
  }).filter(s => s.totalMin > 0)
})

const stats = computed<ProjectStat[]>(() => {
  let list = [...allStats.value]
  const q = normalize(query.value.trim())
  if (q) {
    list = list.filter(s =>
      normalize(s.project.shortName).includes(q)
      || normalize(s.project.code).includes(q)
      || normalize(s.project.name).includes(q),
    )
  }
  if (sortBy.value === 'name') {
    list.sort((a, b) => a.project.shortName.localeCompare(b.project.shortName, 'it'))
  } else if (sortBy.value === 'code') {
    list.sort((a, b) => a.project.code.localeCompare(b.project.code, 'it'))
  } else {
    list.sort((a, b) => b.totalMin - a.totalMin)
  }
  return list
})

const maxMin = computed(() => allStats.value.reduce((m, s) => Math.max(m, s.totalMin), 0))

function selectProject(id: string) {
  if (datasetStore.selectedProjectId === id) {
    datasetStore.selectProject(null)
  } else {
    datasetStore.selectProject(id)
  }
}
</script>

<template>
  <aside class="w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-[73px] self-start h-[calc(100vh-73px)] flex flex-col">
    <div class="p-4 bg-white/95 dark:bg-neutral-950/95 border-b border-neutral-200 dark:border-neutral-800 shrink-0 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Commesse
        </div>
        <span class="text-xs text-neutral-500 tabular-nums">
          <template v-if="query.trim() && stats.length !== allStats.length">
            {{ stats.length }} / {{ allStats.length }}
          </template>
          <template v-else>{{ allStats.length }}</template>
        </span>
      </div>

      <UInput
        v-model="query"
        size="sm"
        icon="i-lucide-search"
        placeholder="Cerca per nome o codice"
        :ui="{ trailing: 'pe-1' }"
        class="w-full"
      >
        <template v-if="query" #trailing>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            :padded="false"
            @click="query = ''"
          />
        </template>
      </UInput>

      <div class="flex gap-1">
        <UButton
          size="xs"
          :variant="sortBy === 'hours' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'hours'"
        >
          Ore
        </UButton>
        <UButton
          size="xs"
          :variant="sortBy === 'name' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'name'"
        >
          Nome
        </UButton>
        <UButton
          size="xs"
          :variant="sortBy === 'code' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'code'"
        >
          Codice
        </UButton>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      <button
        v-for="s in stats"
        :key="s.project.id"
        type="button"
        class="w-full text-left rounded-lg px-3 py-2.5 transition-colors group"
        :class="datasetStore.selectedProjectId === s.project.id
          ? 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-500/30'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'"
        @click="selectProject(s.project.id)"
      >
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <span class="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-2 min-w-0">
            <span
              class="size-2.5 rounded-sm shrink-0"
              :style="{ backgroundColor: s.project.color }"
            />
            <span class="truncate">{{ s.project.shortName }}</span>
          </span>
          <span class="text-xs font-semibold tabular-nums whitespace-nowrap text-neutral-700 dark:text-neutral-300 shrink-0">
            {{ formatHoursIt(s.totalMin) }} h
          </span>
        </div>

        <div class="flex items-center gap-1.5 mb-1.5 min-w-0">
          <span
            v-if="s.project.code"
            class="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 shrink-0 truncate max-w-[10rem]"
          >
            {{ s.project.code }}
          </span>
          <span class="text-[10px] text-neutral-500 truncate">
            {{ s.employeesCount }} dip · {{ s.daysCount }} gg
          </span>
        </div>

        <div class="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :style="{
              width: `${maxMin > 0 ? (s.totalMin / maxMin) * 100 : 0}%`,
              backgroundColor: s.project.color,
            }"
          />
        </div>
      </button>

      <div v-if="allStats.length === 0" class="px-3 py-6 text-xs text-neutral-500 text-center">
        Nessuna commessa con ore registrate.
      </div>
      <div v-else-if="stats.length === 0" class="px-3 py-6 text-xs text-neutral-500 text-center">
        Nessuna commessa corrisponde a "<span class="font-medium">{{ query }}</span>".
      </div>
    </div>
  </aside>
</template>
