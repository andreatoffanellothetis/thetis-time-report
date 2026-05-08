<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { eachDayInRange, fromIsoDate } from '~/utils/dateRange'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import type { DayLog } from '~/types/domain'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()
const employee = computed(() => datasetStore.selectedEmployee!)

const period = computed(() => datasetStore.dataset!.period)

const grid = computed(() => {
  const days = eachDayInRange(period.value.start, period.value.end)
  const first = days[0]!
  const offset = (first.getUTCDay() + 6) % 7
  const cells: Array<Date | null> = []
  for (let i = 0; i < offset; i++) cells.push(null)
  cells.push(...days)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: Array<Array<Date | null>> = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
})

function dayOf(d: Date | null): DayLog | undefined {
  if (!d) return undefined
  return employee.value.daily.get(d.toISOString().slice(0, 10))
}

function bg(day: DayLog | undefined): string {
  if (!day) return 'transparent'
  if (day.status === 'weekend') return '#f3f4f6'
  if (day.status === 'holiday') return '#e0e7ff'
  if (day.status === 'leave') return '#fde68a'
  if (day.status === 'absent') return '#9ca3af'
  if (day.status === 'ok') return '#10b981'
  if (day.status === 'under') return '#ef4444'
  return '#3b82f6'
}

function textColor(day: DayLog | undefined): string {
  if (!day) return 'text-neutral-400'
  if (day.status === 'ok' || day.status === 'under' || day.status === 'over' || day.status === 'absent') return 'text-white'
  if (day.status === 'leave') return 'text-amber-900'
  if (day.status === 'holiday') return 'text-indigo-900'
  return 'text-neutral-600'
}

function tooltip(day: DayLog | undefined): string {
  if (!day) return ''
  const label = day.scheduledLabel ? `${day.scheduledLabel} · ` : ''
  if (day.status === 'weekend') return `${label}Giorno libero`
  if (day.status === 'holiday') return `${label}Festività`
  if (day.status === 'leave') return `${label}assenza giornata intera`
  if (day.status === 'absent') return `${label}Nessuna registrazione · atteso ${formatHHMM(day.expectedMin)}`
  return `${label}${formatHHMM(day.totalMin)} / ${formatHHMM(day.expectedMin)} · ${formatSignedHHMM(day.varianceMin)}`
}
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <template #header>
      <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Calendario del mese
      </div>
    </template>
    <div class="space-y-1">
      <div class="grid grid-cols-7 gap-1 text-[10px] text-neutral-500 font-medium">
        <span v-for="day in ['L','M','M','G','V','S','D']" :key="day" class="text-center">{{ day }}</span>
      </div>
      <div
        v-for="(week, wi) in grid"
        :key="wi"
        class="grid grid-cols-7 gap-1"
      >
        <button
          v-for="(d, di) in week"
          :key="di"
          type="button"
          class="aspect-square rounded-md flex items-center justify-center text-[11px] font-medium tabular-nums transition-transform hover:scale-105"
          :style="{ backgroundColor: bg(dayOf(d)) }"
          :class="[
            !d ? 'invisible' : '',
            textColor(dayOf(d)),
          ]"
          :title="tooltip(dayOf(d))"
          @click="d ? filtersStore.setSingleDay(d.toISOString().slice(0, 10)) : null"
        >
          {{ d ? d.getUTCDate() : '' }}
        </button>
      </div>
    </div>
  </UCard>
</template>
