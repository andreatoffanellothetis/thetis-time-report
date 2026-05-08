<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { formatHHMM, formatHoursIt } from '~/utils/minutes'

const datasetStore = useDatasetStore()
const project = computed(() => datasetStore.selectedProject!)

const stats = computed(() => {
  const ds = datasetStore.dataset
  const p = project.value
  if (!ds || !p) {
    return { totalMin: 0, employees: 0, days: 0, avgPerDay: 0 }
  }
  let totalMin = 0
  const employees = new Set<string>()
  const days = new Set<string>()
  for (const e of ds.employees) {
    let employeeUsed = false
    for (const day of e.daily.values()) {
      for (const entry of day.entries) {
        if (entry.project.id === p.id) {
          totalMin += entry.durationMin
          employeeUsed = true
          days.add(day.isoDate)
        }
      }
    }
    if (employeeUsed) employees.add(e.id)
  }
  const avgPerDay = days.size > 0 ? totalMin / days.size : 0
  return {
    totalMin,
    employees: employees.size,
    days: days.size,
    avgPerDay,
  }
})
</script>

<template>
  <div
    v-if="project"
    class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-3"
  >
    <div class="flex items-center gap-3 flex-wrap">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        @click="datasetStore.selectProject(null)"
      >
        Overview
      </UButton>
      <span class="text-neutral-300 dark:text-neutral-700">/</span>
      <span
        class="size-3 rounded-sm shrink-0"
        :style="{ backgroundColor: project.color }"
      />
      <h2 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {{ project.shortName }}
      </h2>
      <UBadge v-if="project.code" :label="project.code" variant="soft" color="neutral" size="sm" />
      <span v-if="project.name && project.name !== project.shortName" class="text-xs text-neutral-500 truncate">
        {{ project.name }}
      </span>
    </div>

    <div class="flex items-center gap-8 flex-wrap">
      <KpiTile
        label="Ore totali"
        :value="`${formatHoursIt(stats.totalMin)} h`"
        :sub="formatHHMM(stats.totalMin)"
        icon="i-lucide-timer"
      />
      <KpiTile
        label="Dipendenti"
        :value="String(stats.employees)"
        icon="i-lucide-users"
      />
      <KpiTile
        label="Giorni con lavoro"
        :value="String(stats.days)"
        icon="i-lucide-calendar-days"
      />
      <KpiTile
        label="Media h/giorno"
        :value="`${formatHoursIt(stats.avgPerDay)} h`"
        :sub="formatHHMM(stats.avgPerDay)"
        icon="i-lucide-activity"
      />
    </div>
  </div>
</template>
