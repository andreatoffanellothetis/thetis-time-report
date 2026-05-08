<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import { formatDateLong } from '~/utils/dateRange'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()
const employee = computed(() => datasetStore.selectedEmployee!)

const top = computed(() => {
  const list = filtersStore.filterEmployeeDaily(employee.value)
    .filter(d => d.status === 'under' || d.status === 'over' || d.status === 'absent')
  list.sort((a, b) => Math.abs(b.varianceMin) - Math.abs(a.varianceMin))
  return list.slice(0, 6)
})
</script>

<template>
  <UCard :ui="{ body: 'p-2' }">
    <template #header>
      <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Top scostamenti
      </div>
    </template>
    <div v-if="top.length === 0" class="px-3 py-6 text-center text-sm text-neutral-500">
      Nessuno scostamento sopra soglia
    </div>
    <ul v-else class="divide-y divide-neutral-100 dark:divide-neutral-800/50">
      <li
        v-for="d in top"
        :key="d.isoDate"
        class="px-3 py-2 hover:bg-neutral-50 dark:hover:bg-neutral-900/40 cursor-pointer"
        @click="filtersStore.setSingleDay(d.isoDate)"
      >
        <div class="flex items-baseline justify-between gap-2 mb-1">
          <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {{ formatDateLong(d.date) }}
          </span>
          <span
            class="text-sm font-semibold tabular-nums"
            :class="d.varianceMin < 0 ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'"
          >
            {{ formatSignedHHMM(d.varianceMin) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-neutral-500 tabular-nums">
          <span>{{ formatHHMM(d.totalMin) }} su {{ formatHHMM(d.expectedMin) }} attesi</span>
          <span v-if="d.entries.length > 0" class="flex items-center gap-1">
            <span
              v-for="e in d.entries.slice(0, 4)"
              :key="`${d.isoDate}-${e.project.id}`"
              class="size-2 rounded-full"
              :style="{ backgroundColor: e.project.color }"
            />
            <span v-if="d.entries.length > 4" class="text-neutral-400">+{{ d.entries.length - 4 }}</span>
          </span>
          <span v-else class="text-red-500">assente</span>
        </div>
      </li>
    </ul>
  </UCard>
</template>
