<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import { formatDateLong, formatDateShort, fromIsoDate } from '~/utils/dateRange'
import type { DayLog } from '~/types/domain'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const employee = computed(() => datasetStore.selectedEmployee!)
const days = computed(() => filtersStore.filterEmployeeDaily(employee.value))

const isSingleDayFilter = computed(() => {
  const r = filtersStore.dateRange
  return Boolean(r && r[0] === r[1])
})

const filteredLabel = computed(() => {
  const r = filtersStore.dateRange
  if (!r) return ''
  if (r[0] === r[1]) return formatDateLong(fromIsoDate(r[0]))
  return `${formatDateShort(fromIsoDate(r[0]))} – ${formatDateShort(fromIsoDate(r[1]))}`
})

const maxScale = computed(() => {
  let m = 0
  for (const d of days.value) {
    m = Math.max(m, d.totalMin, d.expectedMin)
  }
  return m * 1.1 || 480
})

const hovered = ref<DayLog | null>(null)

function statusBand(status: DayLog['status']): string {
  switch (status) {
    case 'ok': return 'bg-emerald-500'
    case 'under': return 'bg-red-500'
    case 'over': return 'bg-blue-500'
    case 'absent': return 'bg-neutral-400'
    case 'leave': return 'bg-amber-400'
    case 'holiday': return 'bg-indigo-300'
    default: return 'bg-neutral-200 dark:bg-neutral-800'
  }
}

function expectedTopPct(d: DayLog): number {
  if (d.expectedMin === 0) return 0
  return (d.expectedMin / maxScale.value) * 100
}

function isOut(d: DayLog): boolean {
  return d.status === 'under' || d.status === 'over'
}
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <template #header>
      <div class="flex items-baseline justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Ore per giorno e progetto
          </div>
          <div class="text-xs text-neutral-500">
            Linea nera: ore previste per quel giorno (variabile per permessi e festività)
          </div>
        </div>
        <div v-if="hovered" class="text-xs tabular-nums text-neutral-600 dark:text-neutral-400 truncate">
          <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ formatDateShort(hovered.date) }}</span>
          <span v-if="hovered.scheduledLabel" class="text-neutral-500"> · {{ hovered.scheduledLabel }}</span>
          · {{ formatHHMM(hovered.totalMin) }} / {{ formatHHMM(hovered.expectedMin) }} ·
          <span :class="hovered.varianceMin >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'">
            {{ formatSignedHHMM(hovered.varianceMin) }}
          </span>
        </div>
      </div>
    </template>

    <div
      v-if="filtersStore.dateRange"
      class="mb-3 flex items-center gap-2 rounded-lg bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900/50 px-3 py-1.5 text-xs"
    >
      <UIcon name="i-lucide-filter" class="size-3.5 text-primary-600 dark:text-primary-400 shrink-0" />
      <span class="text-primary-900 dark:text-primary-200 font-medium">
        Filtro attivo: {{ filteredLabel }}
      </span>
      <span class="text-primary-700/70 dark:text-primary-300/70">
        {{ days.length === 1 ? 'sto mostrando un solo giorno' : `${days.length} giorni` }}
      </span>
      <UButton
        size="xs"
        variant="ghost"
        color="primary"
        icon="i-lucide-x"
        class="ml-auto"
        @click="filtersStore.clearDateRange()"
      >
        Mostra tutti i giorni
      </UButton>
    </div>

    <div
      class="relative h-[280px] flex items-end gap-1.5"
      :class="isSingleDayFilter ? 'justify-center' : ''"
    >
      <UTooltip
        v-for="d in days"
        :key="d.isoDate"
        :delay-duration="120"
        :ui="{ content: 'h-auto bg-neutral-900 text-white border-0 px-3 py-2.5 shadow-xl ring-0 flex-col items-stretch gap-0 text-xs' }"
      >
        <div
          class="h-full flex flex-col items-stretch group cursor-pointer"
          :class="isSingleDayFilter ? 'w-32' : 'flex-1 min-w-[24px]'"
          @mouseenter="hovered = d"
          @mouseleave="hovered = null"
          @click="filtersStore.setSingleDay(d.isoDate)"
        >
          <div class="flex-1 flex flex-col-reverse min-h-0 relative">
            <template v-if="d.status === 'weekend' || d.status === 'holiday'">
              <div
                class="h-full w-full rounded-t-sm opacity-60"
                :class="d.status === 'holiday' ? 'bg-indigo-100 dark:bg-indigo-950/40' : 'bg-neutral-100 dark:bg-neutral-900'"
              />
            </template>
            <template v-else-if="d.status === 'leave'">
              <div class="h-full w-full rounded-t-sm bg-amber-100 dark:bg-amber-950/40 opacity-60" />
            </template>
            <template v-else>
              <div
                v-for="entry in d.entries.filter(e => filtersStore.isProjectVisible(e.project.id))"
                :key="`${d.isoDate}-${entry.project.id}-${entry.startMin}`"
                class="w-full transition-opacity"
                :class="!filtersStore.allProjectsVisible && !filtersStore.isProjectVisible(entry.project.id) ? 'opacity-20' : ''"
                :style="{
                  backgroundColor: entry.project.color,
                  height: `${(entry.durationMin / maxScale) * 100}%`
                }"
              />
              <div
                v-if="isOut(d)"
                class="absolute inset-0 ring-2 ring-inset pointer-events-none rounded-sm"
                :class="d.status === 'under' ? 'ring-red-500/70' : 'ring-blue-500/70'"
              />
            </template>

            <div
              v-if="d.expectedMin > 0"
              class="absolute left-0 right-0 h-0.5 bg-neutral-700 dark:bg-neutral-300 pointer-events-none"
              :style="{ bottom: `${expectedTopPct(d)}%` }"
            />
          </div>
          <div class="h-1 mt-0.5 rounded-full" :class="statusBand(d.status)" />
          <div class="mt-1 text-[10px] text-center tabular-nums"
            :class="d.isWeekend || d.isHoliday ? 'text-neutral-400' : 'text-neutral-600 dark:text-neutral-400'"
          >
            {{ d.date.getUTCDate() }}
          </div>
        </div>
        <template #content>
          <DayTooltipContent :day="d" />
        </template>
      </UTooltip>
    </div>
  </UCard>
</template>
