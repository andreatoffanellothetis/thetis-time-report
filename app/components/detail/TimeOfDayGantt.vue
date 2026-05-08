<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM } from '~/utils/minutes'
import { formatDateShort } from '~/utils/dateRange'
import type { DayLog } from '~/types/domain'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const employee = computed(() => datasetStore.selectedEmployee!)
const days = computed(() => filtersStore.filterEmployeeDaily(employee.value))

const range = computed(() => {
  let min = 24 * 60
  let max = 0
  for (const d of days.value) {
    for (const e of d.entries) {
      if (e.startMin < min) min = e.startMin
      if (e.endMin > max) max = e.endMin
    }
  }
  if (max <= min) return { min: 7 * 60, max: 19 * 60 }
  const padded = {
    min: Math.floor(Math.max(0, min - 30) / 60) * 60,
    max: Math.ceil(Math.min(24 * 60, max + 30) / 60) * 60,
  }
  return padded
})

function timeToY(min: number, height: number): number {
  const r = range.value
  return ((min - r.min) / (r.max - r.min)) * height
}

function timeLabels(): number[] {
  const out: number[] = []
  for (let m = range.value.min; m <= range.value.max; m += 60) out.push(m)
  return out
}

const hovered = ref<{ d: DayLog; entry: DayLog['entries'][number] } | null>(null)

function fmtMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <template #header>
      <div class="flex items-baseline justify-between">
        <div>
          <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Distribuzione oraria nella giornata
          </div>
          <div class="text-xs text-neutral-500">
            X: giorni · Y: ore della giornata · ogni blocco è una sessione di lavoro su un progetto
          </div>
        </div>
        <div v-if="hovered" class="text-xs tabular-nums text-neutral-600 dark:text-neutral-400">
          <span class="font-medium text-neutral-900 dark:text-neutral-100">{{ formatDateShort(hovered.d.date) }}</span>
          · {{ hovered.entry.project.shortName }}
          · {{ fmtMin(hovered.entry.startMin) }}–{{ fmtMin(hovered.entry.endMin) }}
          ({{ formatHHMM(hovered.entry.durationMin) }})
        </div>
      </div>
    </template>

    <div class="flex">
      <div class="w-12 shrink-0 relative" style="height: 240px">
        <div
          v-for="m in timeLabels()"
          :key="m"
          class="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-neutral-500"
          :style="{ top: `${timeToY(m, 240)}px` }"
        >
          {{ fmtMin(m) }}
        </div>
      </div>
      <div class="flex-1 relative">
        <div class="absolute inset-0">
          <div
            v-for="m in timeLabels()"
            :key="m"
            class="absolute left-0 right-0 border-t border-dashed border-neutral-200 dark:border-neutral-800"
            :style="{ top: `${timeToY(m, 240)}px` }"
          />
        </div>
        <div class="relative flex gap-1.5" style="height: 240px">
          <div
            v-for="d in days"
            :key="d.isoDate"
            class="flex-1 min-w-[24px] relative cursor-pointer"
          >
            <div
              class="absolute inset-0 rounded-sm"
              :class="(d.isWeekend || d.isHoliday) ? 'bg-neutral-100 dark:bg-neutral-900/40' : 'bg-neutral-50/30 dark:bg-neutral-900/20'"
            />
            <UTooltip
              v-for="entry in d.entries.filter(e => filtersStore.isProjectVisible(e.project.id))"
              :key="`${d.isoDate}-${entry.startMin}`"
              :delay-duration="100"
              :ui="{ content: 'h-auto bg-neutral-900 text-white border-0 px-3 py-2 shadow-xl ring-0 flex-col items-stretch gap-0 text-xs' }"
            >
              <div
                class="absolute left-0.5 right-0.5 rounded-[3px] transition-all hover:brightness-110 hover:z-10 hover:ring-2 hover:ring-white dark:hover:ring-neutral-900"
                :style="{
                  top: `${timeToY(entry.startMin, 240)}px`,
                  height: `${timeToY(entry.endMin, 240) - timeToY(entry.startMin, 240)}px`,
                  backgroundColor: entry.project.color,
                  opacity: !filtersStore.allProjectsVisible && !filtersStore.isProjectVisible(entry.project.id) ? 0.2 : 0.92,
                }"
                @mouseenter="hovered = { d, entry }"
                @mouseleave="hovered = null"
              />
              <template #content>
                <div class="flex flex-col gap-1 min-w-[200px]">
                  <div class="flex items-center gap-2">
                    <span class="size-2.5 rounded-sm shrink-0" :style="{ backgroundColor: entry.project.color }" />
                    <span class="font-semibold text-sm text-white">{{ entry.project.shortName }}</span>
                  </div>
                  <div v-if="entry.project.code" class="text-[10px] text-neutral-400 tabular-nums">
                    Codice: {{ entry.project.code }}
                  </div>
                  <div class="text-[11px] text-neutral-300 border-t border-white/10 pt-1.5 mt-1.5">
                    {{ formatDateShort(d.date) }} · {{ fmtMin(entry.startMin) }}–{{ fmtMin(entry.endMin) }}
                  </div>
                  <div class="text-sm text-white font-medium tabular-nums">
                    {{ formatHHMM(entry.durationMin) }}
                  </div>
                </div>
              </template>
            </UTooltip>
          </div>
        </div>
        <div class="mt-1 flex gap-1.5">
          <div
            v-for="d in days"
            :key="d.isoDate"
            class="flex-1 min-w-[24px] text-[10px] text-center tabular-nums"
            :class="d.isWeekend || d.isHoliday ? 'text-neutral-400' : 'text-neutral-500 dark:text-neutral-400'"
          >
            {{ d.date.getUTCDate() }}
          </div>
        </div>
      </div>
    </div>
  </UCard>
</template>
