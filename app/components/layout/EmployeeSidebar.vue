<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { useFiltersStore } from '~/stores/filters'
import { formatSignedHHMM } from '~/utils/minutes'

const datasetStore = useDatasetStore()
const filtersStore = useFiltersStore()

const allEmployees = computed(() => filtersStore.visibleEmployees)
const threshold = computed(() => datasetStore.thresholdMin)
const sortBy = computed({
  get: () => filtersStore.sortBy,
  set: (v) => { filtersStore.sortBy = v },
})

const query = ref('')

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

const employees = computed(() => {
  const q = normalize(query.value.trim())
  if (!q) return allEmployees.value
  return allEmployees.value.filter(e =>
    normalize(e.name).includes(q)
    || normalize(e.organization || '').includes(q),
  )
})

function selectEmployee(id: string) {
  if (datasetStore.selectedEmployeeId === id) {
    datasetStore.selectEmployee(null)
  } else {
    datasetStore.selectEmployee(id)
  }
}

function bgFor(varianceMin: number): string {
  if (Math.abs(varianceMin) <= threshold.value) return 'bg-emerald-500'
  if (varianceMin < 0) return 'bg-red-500'
  return 'bg-blue-500'
}

function ratio(loggedMin: number, expectedMin: number): number {
  if (expectedMin <= 0) return loggedMin > 0 ? 1 : 0
  return Math.min(1, loggedMin / expectedMin)
}

function expectedRef(e: { monthlyExpectedFull: number; monthlyExpected: number }): number {
  return e.monthlyExpectedFull > 0 ? e.monthlyExpectedFull : e.monthlyExpected
}
</script>

<template>
  <aside class="w-72 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 sticky top-[73px] self-start h-[calc(100vh-73px)] flex flex-col">
    <div class="p-4 bg-white/95 dark:bg-neutral-950/95 border-b border-neutral-200 dark:border-neutral-800 shrink-0 space-y-2.5">
      <div class="flex items-center justify-between">
        <div class="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
          Dipendenti
        </div>
        <span class="text-xs text-neutral-500 tabular-nums">
          <template v-if="query.trim() && employees.length !== allEmployees.length">
            {{ employees.length }} / {{ allEmployees.length }}
          </template>
          <template v-else>{{ allEmployees.length }}</template>
        </span>
      </div>

      <UInput
        v-model="query"
        size="sm"
        icon="i-lucide-search"
        placeholder="Cerca per nome o azienda"
        :ui="{ trailing: 'pe-1' }"
        class="w-full"
      >
        <template v-if="query" #trailing>
          <UButton
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-x"
            :padded="false"
            @click="query = ''"
          />
        </template>
      </UInput>

      <div class="flex gap-1">
        <UButton
          size="xs"
          :variant="sortBy === 'variance' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'variance'"
        >
          Scostamento
        </UButton>
        <UButton
          size="xs"
          :variant="sortBy === 'name' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'name'"
        >
          Nome
        </UButton>
        <UButton
          size="xs"
          :variant="sortBy === 'logged' ? 'soft' : 'ghost'"
          color="neutral"
          @click="sortBy = 'logged'"
        >
          Ore
        </UButton>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
      <button
        v-for="e in employees"
        :key="e.id"
        type="button"
        class="w-full text-left rounded-lg px-3 py-2.5 transition-colors group"
        :class="datasetStore.selectedEmployeeId === e.id
          ? 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-500/30'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'"
        @click="selectEmployee(e.id)"
      >
        <div class="flex items-baseline justify-between gap-2 mb-1">
          <span class="font-medium text-sm text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-1.5 min-w-0">
            <span class="truncate">{{ e.name }}</span>
            <UIcon
              v-if="e.absenceDays > 0 && e.absenceMin < e.absenceDays * e.expectedPerDay"
              name="i-lucide-info"
              class="size-3 text-amber-500 shrink-0"
            />
          </span>
          <span
            class="text-xs font-semibold tabular-nums"
            :class="[
              Math.abs(e.varianceFull) <= threshold ? 'text-emerald-600 dark:text-emerald-400' :
              e.varianceFull < 0 ? 'text-red-600 dark:text-red-400' :
              'text-blue-600 dark:text-blue-400'
            ]"
          >
            {{ formatSignedHHMM(e.varianceFull) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="bgFor(e.varianceFull)"
              :style="{ width: `${ratio(e.monthlyLogged, expectedRef(e)) * 100}%` }"
            />
          </div>
          <span class="text-[10px] text-neutral-500 truncate max-w-[5rem]">
            {{ e.organization || '—' }}
          </span>
        </div>
      </button>

      <div v-if="allEmployees.length === 0" class="px-3 py-6 text-xs text-neutral-500 text-center">
        Nessun dipendente.
      </div>
      <div v-else-if="employees.length === 0" class="px-3 py-6 text-xs text-neutral-500 text-center">
        Nessun dipendente corrisponde a "<span class="font-medium">{{ query }}</span>".
      </div>
    </div>
  </aside>
</template>
