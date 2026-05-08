<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const employees = computed(() => filtersStore.visibleEmployees)
const threshold = computed(() => datasetStore.thresholdMin)

const maxScale = computed(() => {
  let m = 0
  for (const e of employees.value) {
    m = Math.max(m, e.monthlyExpectedFull, e.monthlyLogged)
  }
  return m || 1
})

function loggedPct(loggedMin: number): number {
  return (loggedMin / maxScale.value) * 100
}
function expectedPct(expectedMin: number): number {
  return (expectedMin / maxScale.value) * 100
}
function barColor(varianceMin: number): string {
  if (Math.abs(varianceMin) <= threshold.value) return 'bg-emerald-500/80'
  if (varianceMin < 0) return 'bg-red-500/80'
  return 'bg-blue-500/80'
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
          Ore registrate vs previste
        </div>
        <div class="text-xs text-neutral-500">
          Barra: ore registrate · marker: ore previste
        </div>
      </div>
    </template>
    <div class="space-y-2">
      <UTooltip
        v-for="e in employees"
        :key="e.id"
        :delay-duration="200"
        :ui="{ content: 'h-auto bg-neutral-900 text-white border-0 px-3 py-2.5 shadow-xl ring-0 flex-col items-stretch gap-0 text-xs' }"
      >
        <div class="grid grid-cols-[180px_1fr_auto] items-center gap-3 text-sm group">
          <button
            type="button"
            class="text-left truncate text-neutral-800 dark:text-neutral-200 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
            @click="datasetStore.selectEmployee(e.id)"
          >
            {{ e.name }}
          </button>
          <div class="relative h-6 rounded-md bg-neutral-100 dark:bg-neutral-800/60 overflow-hidden cursor-pointer" @click="datasetStore.selectEmployee(e.id)">
            <div
              class="absolute inset-y-0 left-0 transition-all"
              :class="barColor(e.varianceFull)"
              :style="{ width: `${loggedPct(e.monthlyLogged)}%` }"
            />
            <div
              class="absolute inset-y-0 w-0.5 bg-neutral-900 dark:bg-neutral-100"
              :style="{ left: `${expectedPct(e.monthlyExpectedFull)}%` }"
            />
            <div class="absolute inset-0 px-2 flex items-center text-[11px] tabular-nums">
              <span class="text-neutral-700 dark:text-neutral-300 mix-blend-difference">
                {{ formatHHMM(e.monthlyLogged) }} / {{ formatHHMM(e.monthlyExpectedFull) }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 tabular-nums">
            <span
              class="text-sm font-semibold w-20 text-right"
              :class="[
                Math.abs(e.varianceFull) <= threshold ? 'text-emerald-600 dark:text-emerald-400' :
                e.varianceFull < 0 ? 'text-red-600 dark:text-red-400' :
                'text-blue-600 dark:text-blue-400'
              ]"
            >
              {{ formatSignedHHMM(e.varianceFull) }}
            </span>
            <span class="text-xs text-neutral-500 w-14 text-right">
              {{ (e.variancePctFull * 100).toFixed(1) }}%
            </span>
          </div>
        </div>
        <template #content>
          <EmployeeTooltipContent :employee="e" />
        </template>
      </UTooltip>
    </div>
  </UCard>
</template>
