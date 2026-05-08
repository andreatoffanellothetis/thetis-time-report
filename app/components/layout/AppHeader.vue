<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import { formatPeriod } from '~/utils/dateRange'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const totals = computed(() => datasetStore.dataset?.totals)
const period = computed(() => datasetStore.dataset?.period)

const projectsItems = computed(() =>
  (datasetStore.dataset?.projects ?? []).map(p => ({
    label: p.shortName,
    value: p.id,
    chip: { color: 'neutral' as const, style: { backgroundColor: p.color } },
  })),
)

const projectsModel = computed({
  get: () => Array.from(filtersStore.visibleProjectIds),
  set: (val: string[]) => {
    const all = datasetStore.dataset?.projects.length ?? 0
    if (val.length === 0 || val.length === all) filtersStore.showAllProjects()
    else filtersStore.visibleProjectIds = new Set(val)
  },
})

const variancePctFullText = computed(() => {
  const v = totals.value?.variancePctFull ?? 0
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
})

const avgRealHoursPerEmployee = computed(() => {
  const ds = datasetStore.dataset
  if (!ds || ds.employees.length === 0) return 0
  const totalRealMin = ds.employees.reduce((s, e) => s + e.monthlyLogged, 0)
  const totalDaysWithLog = ds.employees.reduce((s, e) => s + e.daysWithLog, 0)
  if (totalDaysWithLog === 0) return 0
  return totalRealMin / totalDaysWithLog
})
</script>

<template>
  <header
    v-if="datasetStore.isReady"
    class="sticky top-0 z-30 border-b border-neutral-200 dark:border-neutral-800 bg-white/85 dark:bg-neutral-950/85 backdrop-blur-xl"
  >
    <div class="px-6 py-3 flex items-center gap-5">
      <div class="flex items-center gap-3 min-w-0 shrink-0">
        <div class="size-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0">
          <UIcon name="i-lucide-clock-9" class="size-5" />
        </div>
        <div class="min-w-0">
          <div class="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
            Report presenze Thetis
          </div>
          <div class="text-xs text-neutral-500 truncate">
            <span v-if="period">{{ formatPeriod(period.start, period.end) }} · {{ period.workingDays }} giorni feriali</span>
          </div>
        </div>
      </div>

      <div class="h-8 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />

      <div class="inline-flex p-0.5 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shrink-0">
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
          :class="datasetStore.viewMode === 'employee'
            ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
          @click="datasetStore.setViewMode('employee')"
        >
          <UIcon name="i-lucide-users" class="size-3.5" />
          Dipendenti
        </button>
        <button
          type="button"
          class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5"
          :class="datasetStore.viewMode === 'project'
            ? 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 shadow-sm'
            : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'"
          @click="datasetStore.setViewMode('project')"
        >
          <UIcon name="i-lucide-folder-kanban" class="size-3.5" />
          Commesse
        </button>
      </div>

      <div
        v-if="!datasetStore.selectedEmployee && !datasetStore.selectedProject && datasetStore.viewMode === 'employee'"
        class="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto kpi-scroll"
      >
        <UTooltip text="Pieno teorico aziendale: somma di (ore previste/giorno × giorni feriali del periodo) per ogni dipendente">
          <KpiTile
            class="shrink-0"
            label="Pieno teorico"
            :value="formatHHMM(totals?.expectedFull ?? 0)"
            icon="i-lucide-target"
          />
        </UTooltip>
        <KpiTile
          class="shrink-0"
          label="Registrate"
          :value="formatHHMM(totals?.logged ?? 0)"
          icon="i-lucide-timer"
        />
        <UTooltip text="Differenza tra ore registrate sui progetti e pieno teorico">
          <KpiTile
            class="shrink-0"
            label="Scostamento"
            :value="formatSignedHHMM(totals?.varianceFull ?? 0)"
            :sub="variancePctFullText"
            :tone="(Math.abs((totals?.varianceFull ?? 0)) <= datasetStore.thresholdMin ? 'positive' : (totals?.varianceFull ?? 0) < 0 ? 'negative' : 'warning')"
            icon="i-lucide-trending-up"
          />
        </UTooltip>
        <KpiTile
          class="shrink-0"
          label="Fuori soglia"
          :value="String(totals?.employeesOutOfThreshold ?? 0)"
          :sub="`su ${datasetStore.dataset?.employees.length ?? 0} dip.`"
          :tone="((totals?.employeesOutOfThreshold ?? 0) > 0 ? 'warning' : 'neutral')"
          icon="i-lucide-alert-triangle"
        />
        <KpiTile
          class="shrink-0"
          label="Media h/giorno"
          :value="formatHHMM(avgRealHoursPerEmployee)"
          icon="i-lucide-activity"
        />
      </div>
      <div v-else class="flex-1" />


      <div class="flex items-center gap-2 shrink-0">
        <USelectMenu
          v-if="datasetStore.viewMode === 'employee'"
          v-model="projectsModel"
          :items="projectsItems"
          multiple
          value-key="value"
          placeholder="Tutti i progetti"
          icon="i-lucide-folder-kanban"
          class="w-56"
        />
        <UPopover>
          <UButton
            size="sm"
            variant="soft"
            color="neutral"
            icon="i-lucide-sliders-horizontal"
          >
            Opzioni
          </UButton>
          <template #content>
            <div class="p-4 w-72 flex flex-col gap-2">
              <UCheckbox
                v-model="filtersStore.onlyOutOfThreshold"
                label="Mostra solo dipendenti con scostamenti"
              />
              <UCheckbox
                v-model="filtersStore.includeWeekend"
                label="Includi weekend e festivi nei grafici"
              />
            </div>
          </template>
        </UPopover>
        <DropZone variant="compact" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.kpi-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.kpi-scroll::-webkit-scrollbar {
  display: none;
}
</style>
