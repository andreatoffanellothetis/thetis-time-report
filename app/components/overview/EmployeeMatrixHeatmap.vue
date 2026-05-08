<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { eachDayInRange } from '~/utils/dateRange'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import type { DayLog, Employee } from '~/types/domain'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const days = computed(() => {
  const ds = datasetStore.dataset
  if (!ds) return [] as Date[]
  return eachDayInRange(ds.period.start, ds.period.end)
})

const employees = computed(() => filtersStore.visibleEmployees)

function colorFor(day: DayLog | undefined): string {
  if (!day) return 'transparent'
  if (day.status === 'weekend') return '#f3f4f6'
  if (day.status === 'holiday') return '#e0e7ff'
  if (day.status === 'leave') return '#fde68a'
  if (day.status === 'absent') return '#9ca3af'
  if (day.status === 'ok') return '#10b981'
  const ratio = Math.min(1, Math.abs(day.varianceMin) / Math.max(60, day.expectedMin || 60))
  if (day.status === 'under') return `rgba(239, 68, 68, ${0.4 + ratio * 0.6})`
  return `rgba(59, 130, 246, ${0.4 + ratio * 0.6})`
}

function tooltip(employee: Employee, day: DayLog | undefined): string {
  if (!day) return ''
  const label = day.scheduledLabel ? `${day.scheduledLabel} · ` : ''
  if (day.status === 'weekend') return `${employee.name} · ${label || 'giorno libero'}`
  if (day.status === 'holiday') return `${employee.name} · festività`
  if (day.status === 'leave') return `${employee.name} · ${label || 'assenza intera giornata'}`
  if (day.status === 'absent') return `${employee.name} · ${label}nessuna registrazione (atteso ${formatHHMM(day.expectedMin)})`
  return `${employee.name}\n${label}${formatHHMM(day.totalMin)} / ${formatHHMM(day.expectedMin)} · scost. ${formatSignedHHMM(day.varianceMin)}`
}

function onClick(employeeId: string, day: DayLog | undefined) {
  datasetStore.selectEmployee(employeeId)
  if (day && !day.isWeekend && !day.isHoliday) {
    filtersStore.setSingleDay(day.isoDate)
  }
}

function dayLabel(d: Date): string {
  return String(d.getUTCDate())
}
function isFirstOfWeek(d: Date): boolean {
  return d.getUTCDay() === 1
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0' }"
    class="overflow-hidden"
  >
    <template #header>
      <div class="flex items-baseline justify-between">
        <div>
          <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Mappa giornaliera scostamenti
          </div>
          <div class="text-xs text-neutral-500">
            Ogni cella è un giorno · click per filtrare il dettaglio
          </div>
        </div>
        <div class="flex items-center gap-3 text-xs text-neutral-500">
          <span class="flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-emerald-500" />
            in linea
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-red-500" />
            sotto
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-blue-500" />
            sopra
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-3 rounded-sm bg-neutral-400" />
            assente
          </span>
        </div>
      </div>
    </template>

    <div class="overflow-x-auto">
      <table class="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th class="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-3 py-2 text-left font-medium text-neutral-500 min-w-[180px]" />
            <th
              v-for="d in days"
              :key="d.toISOString()"
              class="px-0 pb-2 text-center font-medium tabular-nums"
              :class="[
                isFirstOfWeek(d) ? 'border-l border-neutral-200 dark:border-neutral-800' : '',
                d.getUTCDay() === 0 || d.getUTCDay() === 6
                  ? 'text-neutral-400'
                  : 'text-neutral-600 dark:text-neutral-400',
              ]"
              :style="{ minWidth: '24px', width: '24px' }"
            >
              {{ dayLabel(d) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in employees" :key="e.id">
            <td
              class="sticky left-0 z-10 bg-white dark:bg-neutral-950 px-3 py-1 border-t border-neutral-100 dark:border-neutral-900 truncate max-w-[200px]"
            >
              <button
                type="button"
                class="text-left text-neutral-800 dark:text-neutral-200 hover:text-primary-600 dark:hover:text-primary-400 font-medium truncate w-full"
                @click="datasetStore.selectEmployee(e.id)"
              >
                {{ e.name }}
              </button>
            </td>
            <td
              v-for="d in days"
              :key="d.toISOString()"
              class="p-0.5 border-t border-neutral-100 dark:border-neutral-900"
              :class="isFirstOfWeek(d) ? 'border-l border-neutral-200 dark:border-neutral-800' : ''"
            >
              <UTooltip
                v-if="e.daily.get(d.toISOString().slice(0, 10))"
                :delay-duration="120"
                :ui="{ content: 'h-auto bg-neutral-900 text-white border-0 px-3 py-2.5 shadow-xl ring-0 flex-col items-stretch gap-0 text-xs' }"
              >
                <button
                  type="button"
                  class="block size-5 rounded-[3px] transition-transform hover:scale-110 hover:ring-2 hover:ring-primary-500 hover:ring-offset-1 hover:ring-offset-white dark:hover:ring-offset-neutral-950"
                  :style="{ backgroundColor: colorFor(e.daily.get(d.toISOString().slice(0, 10))) }"
                  @click="onClick(e.id, e.daily.get(d.toISOString().slice(0, 10)))"
                />
                <template #content>
                  <div class="space-y-1.5 min-w-[240px]">
                    <div class="font-semibold text-sm text-white">{{ e.name }}</div>
                    <DayTooltipContent :day="e.daily.get(d.toISOString().slice(0, 10))!" />
                  </div>
                </template>
              </UTooltip>
              <div
                v-else
                class="size-5"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
