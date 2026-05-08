<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM } from '~/utils/minutes'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()
const employee = computed(() => datasetStore.selectedEmployee!)
const breakdown = computed(() => employee.value.projectBreakdown)

const SIZE = 200
const RADIUS = 80
const STROKE = 24
const CIRC = 2 * Math.PI * RADIUS

const segments = computed(() => {
  let acc = 0
  return breakdown.value.map((b) => {
    const dash = b.pct * CIRC
    const offset = -acc * CIRC
    acc += b.pct
    return {
      project: b.project,
      pct: b.pct,
      totalMin: b.totalMin,
      dash,
      offset,
    }
  })
})

const totalLogged = computed(() => employee.value.monthlyLogged)
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <template #header>
      <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Ripartizione progetti
      </div>
    </template>
    <div class="flex flex-col items-center gap-3">
      <svg :width="SIZE" :height="SIZE" :viewBox="`0 0 ${SIZE} ${SIZE}`" class="-rotate-90">
        <circle
          :cx="SIZE / 2"
          :cy="SIZE / 2"
          :r="RADIUS"
          fill="none"
          class="stroke-neutral-100 dark:stroke-neutral-800"
          :stroke-width="STROKE"
        />
        <circle
          v-for="s in segments"
          :key="s.project.id"
          :cx="SIZE / 2"
          :cy="SIZE / 2"
          :r="RADIUS"
          fill="none"
          :stroke="s.project.color"
          :stroke-width="STROKE"
          :stroke-dasharray="`${s.dash} ${CIRC - s.dash}`"
          :stroke-dashoffset="s.offset"
          class="transition-opacity cursor-pointer"
          :class="!filtersStore.allProjectsVisible && !filtersStore.isProjectVisible(s.project.id) ? 'opacity-25' : ''"
          @click="filtersStore.toggleProject(s.project.id)"
        />
        <g class="rotate-90 origin-center">
          <text
            :x="SIZE / 2"
            :y="SIZE / 2 - 6"
            text-anchor="middle"
            class="text-[11px] uppercase tracking-wide fill-neutral-500"
          >
            Totale
          </text>
          <text
            :x="SIZE / 2"
            :y="SIZE / 2 + 14"
            text-anchor="middle"
            class="text-base font-semibold fill-neutral-900 dark:fill-neutral-100 tabular-nums"
          >
            {{ formatHHMM(totalLogged) }}
          </text>
        </g>
      </svg>
      <div class="w-full space-y-1.5 text-xs">
        <button
          v-for="b in breakdown"
          :key="b.project.id"
          type="button"
          class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-900 group"
          :class="!filtersStore.allProjectsVisible && !filtersStore.isProjectVisible(b.project.id) ? 'opacity-50' : ''"
          @click="filtersStore.toggleProject(b.project.id)"
        >
          <span
            class="size-3 rounded-sm shrink-0"
            :style="{ backgroundColor: b.project.color }"
          />
          <span class="flex-1 text-left truncate text-neutral-700 dark:text-neutral-300 font-medium">
            {{ b.project.shortName }}
          </span>
          <span class="text-neutral-500 tabular-nums shrink-0">{{ formatHHMM(b.totalMin) }}</span>
          <span class="text-neutral-400 tabular-nums w-10 text-right shrink-0">
            {{ (b.pct * 100).toFixed(0) }}%
          </span>
        </button>
      </div>
    </div>
  </UCard>
</template>
