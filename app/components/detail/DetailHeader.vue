<script setup lang="ts">
import { computed } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { formatHHMM, formatSignedHHMM } from '~/utils/minutes'

const datasetStore = useDatasetStore()
const e = computed(() => datasetStore.selectedEmployee)
const threshold = computed(() => datasetStore.thresholdMin)

const avgPerWorkingDay = computed(() => {
  if (!e.value) return 0
  if (e.value.daysWithLog === 0) return 0
  return e.value.monthlyLogged / e.value.daysWithLog
})

const variancePctFullText = computed(() => {
  const v = e.value?.variancePctFull ?? 0
  const sign = v > 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
})

const officialDifferent = computed(() => {
  if (!e.value) return false
  return e.value.monthlyExpected !== e.value.monthlyExpectedFull
})

const officialVarianceText = computed(() => {
  if (!e.value) return ''
  return formatSignedHHMM(e.value.variance)
})

const periodWorkingDays = computed(() => datasetStore.dataset?.period.workingDays ?? 0)
</script>

<template>
  <div
    v-if="e"
    class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 space-y-3"
  >
    <div class="flex items-center gap-3 flex-wrap">
      <UButton
        size="sm"
        variant="ghost"
        color="neutral"
        icon="i-lucide-arrow-left"
        @click="datasetStore.selectEmployee(null)"
      >
        Overview
      </UButton>
      <span class="text-neutral-300 dark:text-neutral-700">/</span>
      <h2 class="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {{ e.name }}
      </h2>
      <UBadge v-if="e.organization" :label="e.organization" variant="soft" color="neutral" size="sm" />
      <span class="text-xs text-neutral-500 ml-2">
        Ore previste/giorno: {{ formatHHMM(e.expectedPerDay) }} · {{ periodWorkingDays }} giorni feriali nel periodo
      </span>
    </div>

    <div class="flex items-center gap-8 flex-wrap">
      <UTooltip
        :text="`Pieno teorico = ore previste/giorno × giorni feriali del periodo (${formatHHMM(e.expectedPerDay)} × ${periodWorkingDays})`"
      >
        <KpiTile
          label="Pieno teorico"
          :value="formatHHMM(e.monthlyExpectedFull)"
          icon="i-lucide-target"
        />
      </UTooltip>
      <UTooltip
        v-if="officialDifferent"
        :text="`Programmate dichiarate dal gestionale (decurtate per ${e.absenceDays} giorni di assenza). Scostamento ufficiale: ${officialVarianceText}.`"
      >
        <KpiTile
          label="Programmate (Thetis)"
          :value="formatHHMM(e.monthlyExpected)"
          :sub="officialVarianceText"
          icon="i-lucide-calendar-clock"
          tone="neutral"
        />
      </UTooltip>
      <KpiTile
        label="Registrate"
        :value="formatHHMM(e.monthlyLogged)"
        icon="i-lucide-timer"
      />
      <UTooltip text="Differenza tra ore registrate sui progetti e pieno teorico (= ore previste/giorno × giorni feriali)">
        <KpiTile
          label="Scostamento"
          :value="formatSignedHHMM(e.varianceFull)"
          :sub="variancePctFullText"
          :tone="(Math.abs(e.varianceFull) <= threshold ? 'positive' : e.varianceFull < 0 ? 'negative' : 'warning')"
          icon="i-lucide-trending-up"
        />
      </UTooltip>
      <KpiTile
        label="Assenze"
        :value="String(e.absenceDays)"
        :sub="e.absenceMin > 0 ? `+ ${formatHHMM(e.absenceMin)}` : 'giorni'"
        :tone="(e.absenceDays > 0 ? 'warning' : 'neutral')"
        icon="i-lucide-calendar-x"
      />
      <KpiTile
        label="Progetti"
        :value="String(e.projectBreakdown.length)"
        icon="i-lucide-folder-kanban"
      />
      <KpiTile
        label="Media h/giorno"
        :value="formatHHMM(avgPerWorkingDay)"
        icon="i-lucide-activity"
      />
    </div>
  </div>
</template>
