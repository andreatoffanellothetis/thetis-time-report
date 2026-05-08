<script setup lang="ts">
import { computed } from 'vue'
import type { Employee } from '~/types/domain'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import { useDatasetStore } from '~/stores/dataset'

const props = defineProps<{
  employee: Employee
}>()

const datasetStore = useDatasetStore()

const variancePctText = computed(() => {
  const v = props.employee.variancePctFull
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
})

const variantClass = computed(() => {
  const t = datasetStore.thresholdMin
  if (Math.abs(props.employee.varianceFull) <= t) return 'text-emerald-400'
  if (props.employee.varianceFull < 0) return 'text-red-400'
  return 'text-blue-400'
})

const topProjects = computed(() => props.employee.projectBreakdown.slice(0, 5))
</script>

<template>
  <div class="flex flex-col gap-2 min-w-[260px] max-w-[340px]">
    <div>
      <div class="font-semibold text-sm text-white">{{ employee.name }}</div>
      <div v-if="employee.organization" class="text-[11px] text-neutral-400">
        {{ employee.organization }}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs tabular-nums border-t border-white/10 pt-2">
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Previste</div>
        <div class="text-white font-medium">{{ formatHHMM(employee.monthlyExpectedFull) }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Registrate</div>
        <div class="text-white font-medium">{{ formatHHMM(employee.monthlyLogged) }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Scost.</div>
        <div class="font-medium" :class="variantClass">
          {{ formatSignedHHMM(employee.varianceFull) }}
          <span class="text-[10px] opacity-80">({{ variancePctText }})</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 text-[11px] text-neutral-300">
      <div>
        <span class="text-neutral-400">Anomalie:</span>
        <span class="ml-1 text-white">{{ employee.daysAnomaly }}</span>
      </div>
      <div>
        <span class="text-neutral-400">Giorni log:</span>
        <span class="ml-1 text-white">{{ employee.daysWithLog }}</span>
      </div>
      <div>
        <span class="text-neutral-400">Progetti:</span>
        <span class="ml-1 text-white">{{ employee.projectBreakdown.length }}</span>
      </div>
    </div>

    <div v-if="topProjects.length > 0" class="border-t border-white/10 pt-2 flex flex-col gap-1">
      <div class="text-[10px] uppercase tracking-wide text-neutral-400">Top progetti</div>
      <div
        v-for="b in topProjects"
        :key="b.project.id"
        class="flex items-center gap-2 text-[11px]"
      >
        <span
          class="size-2 rounded-sm shrink-0"
          :style="{ backgroundColor: b.project.color }"
        />
        <span class="text-neutral-200 truncate flex-1">{{ b.project.shortName }}</span>
        <span class="text-neutral-300 tabular-nums shrink-0">{{ formatHHMM(b.totalMin) }}</span>
        <span class="text-neutral-500 tabular-nums shrink-0 w-9 text-right">{{ (b.pct * 100).toFixed(0) }}%</span>
      </div>
      <div v-if="employee.projectBreakdown.length > topProjects.length" class="text-[10px] text-neutral-500">
        e altri {{ employee.projectBreakdown.length - topProjects.length }}
      </div>
    </div>
  </div>
</template>
