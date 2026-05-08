<script setup lang="ts">
import { computed } from 'vue'
import type { DayLog } from '~/types/domain'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'
import { formatDateLong } from '~/utils/dateRange'
import { useFiltersStore } from '~/stores/filters'

const props = defineProps<{
  day: DayLog
}>()

const filtersStore = useFiltersStore()

const visibleEntries = computed(() =>
  props.day.entries.filter(e => filtersStore.isProjectVisible(e.project.id)),
)

const hiddenCount = computed(() => props.day.entries.length - visibleEntries.value.length)

const statusColor = computed(() => {
  switch (props.day.status) {
    case 'ok': return 'text-emerald-400'
    case 'under': return 'text-red-400'
    case 'over': return 'text-blue-400'
    case 'absent': return 'text-amber-400'
    case 'leave': return 'text-amber-400'
    case 'holiday': return 'text-indigo-300'
    case 'weekend': return 'text-neutral-400'
    default: return 'text-neutral-300'
  }
})

const statusLabel = computed(() => {
  switch (props.day.status) {
    case 'ok': return 'in linea'
    case 'under': return 'sotto le ore previste'
    case 'over': return 'sopra le ore previste'
    case 'absent': return 'nessuna registrazione'
    case 'leave': return 'assenza giornata intera'
    case 'holiday': return 'festività'
    case 'weekend': return 'giorno libero'
    default: return ''
  }
})
</script>

<template>
  <div class="flex flex-col gap-2 min-w-[260px] max-w-[340px]">
    <div class="flex flex-col gap-0.5">
      <div class="font-semibold text-sm text-white capitalize">
        {{ formatDateLong(day.date) }}
      </div>
      <div v-if="day.scheduledLabel" class="text-[11px] text-neutral-300">
        {{ day.scheduledLabel }}
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 text-xs tabular-nums border-t border-white/10 pt-2">
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Previste</div>
        <div class="text-white font-medium">{{ formatHHMM(day.expectedMin) }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Registrate</div>
        <div class="text-white font-medium">{{ formatHHMM(day.totalMin) }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-wide text-neutral-400">Scost.</div>
        <div class="font-medium" :class="statusColor">{{ formatSignedHHMM(day.varianceMin) }}</div>
      </div>
    </div>

    <div v-if="statusLabel" class="text-[11px]" :class="statusColor">
      {{ statusLabel }}
    </div>

    <div v-if="day.anomaly" class="text-[11px] text-amber-300 flex items-center gap-1">
      <span class="size-1.5 rounded-full bg-amber-400 inline-block" />
      anomalia: {{ day.anomaly }}
    </div>

    <div v-if="visibleEntries.length > 0" class="border-t border-white/10 pt-2 flex flex-col gap-1">
      <div class="text-[10px] uppercase tracking-wide text-neutral-400">
        Progetti
      </div>
      <div
        v-for="entry in visibleEntries.slice(0, 6)"
        :key="`${day.isoDate}-${entry.project.id}-${entry.startMin}`"
        class="flex items-center gap-2 text-[11px]"
      >
        <span
          class="size-2 rounded-sm shrink-0"
          :style="{ backgroundColor: entry.project.color }"
        />
        <span class="text-neutral-200 truncate flex-1">{{ entry.project.shortName }}</span>
        <span class="text-neutral-300 tabular-nums shrink-0">{{ formatHHMM(entry.durationMin) }}</span>
      </div>
      <div v-if="visibleEntries.length > 6" class="text-[10px] text-neutral-400">
        e altri {{ visibleEntries.length - 6 }}
      </div>
      <div v-if="hiddenCount > 0" class="text-[10px] text-neutral-500">
        {{ hiddenCount }} progett{{ hiddenCount === 1 ? 'o' : 'i' }} nascost{{ hiddenCount === 1 ? 'o' : 'i' }} dal filtro
      </div>
    </div>
  </div>
</template>
