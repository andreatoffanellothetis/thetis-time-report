<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'
import { eachDayInRange, toIsoDate } from '~/utils/dateRange'
import { formatHoursIt, formatHHMM } from '~/utils/minutes'
import { copyMatrixToClipboard, exportMatrixXlsx, type MatrixModel } from '~/utils/exportProjectMatrix'

const datasetStore = useDatasetStore()

const project = computed(() => datasetStore.selectedProject!)

const days = computed(() => {
  const ds = datasetStore.dataset
  if (!ds) return [] as Date[]
  return eachDayInRange(ds.period.start, ds.period.end)
})

interface Row {
  employeeId: string
  employeeName: string
  organization: string
  byDay: Map<string, number>
  total: number
}

const rows = computed<Row[]>(() => {
  const ds = datasetStore.dataset
  const p = project.value
  if (!ds || !p) return []

  const out: Row[] = []
  for (const e of ds.employees) {
    let total = 0
    const byDay = new Map<string, number>()
    for (const day of e.daily.values()) {
      let dayTotal = 0
      for (const entry of day.entries) {
        if (entry.project.id === p.id) dayTotal += entry.durationMin
      }
      if (dayTotal > 0) {
        byDay.set(day.isoDate, dayTotal)
        total += dayTotal
      }
    }
    if (total > 0) {
      out.push({
        employeeId: e.id,
        employeeName: e.name,
        organization: e.organization,
        byDay,
        total,
      })
    }
  }
  out.sort((a, b) => b.total - a.total)
  return out
})

const dayTotals = computed<Map<string, number>>(() => {
  const map = new Map<string, number>()
  for (const r of rows.value) {
    for (const [iso, min] of r.byDay) {
      map.set(iso, (map.get(iso) ?? 0) + min)
    }
  }
  return map
})

const grandTotal = computed(() => rows.value.reduce((s, r) => s + r.total, 0))

function isWeekendDate(d: Date): boolean {
  const dow = d.getUTCDay()
  return dow === 0 || dow === 6
}

const dowLetters = ['D', 'L', 'M', 'M', 'G', 'V', 'S']
function dowLetter(d: Date): string {
  return dowLetters[d.getUTCDay()]!
}

const matrixModel = computed<MatrixModel>(() => ({
  project: project.value,
  period: datasetStore.dataset!.period,
  days: days.value,
  rows: rows.value,
  dayTotals: dayTotals.value,
  grandTotal: grandTotal.value,
}))

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

async function onCopy() {
  await copyMatrixToClipboard(matrixModel.value)
  copied.value = true
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1800)
}

async function onExport() {
  await exportMatrixXlsx(matrixModel.value)
}

const hoveredCell = ref<{ row: string, iso: string } | null>(null)
function isHovered(rowId: string, iso: string): boolean {
  return hoveredCell.value?.row === rowId && hoveredCell.value?.iso === iso
}
function isHoveredRow(rowId: string): boolean {
  return hoveredCell.value?.row === rowId
}
function isHoveredCol(iso: string): boolean {
  return hoveredCell.value?.iso === iso
}

const copiedKey = ref<string | null>(null)
let copiedKeyTimer: ReturnType<typeof setTimeout> | null = null

async function copyValue(min: number, key: string) {
  if (min <= 0) return
  const value = formatHoursIt(min)
  try {
    await navigator.clipboard.writeText(value)
    copiedKey.value = key
    if (copiedKeyTimer) clearTimeout(copiedKeyTimer)
    copiedKeyTimer = setTimeout(() => { copiedKey.value = null }, 900)
  } catch {
    // fallback silenzioso: alcuni browser bloccano clipboard se la pagina non ha focus
  }
}

function isCopied(key: string): boolean {
  return copiedKey.value === key
}
</script>

<template>
  <UCard :ui="{ body: 'p-0', header: 'p-4' }" class="overflow-hidden">
    <template #header>
      <div class="flex items-baseline justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            Ore per giorno e dipendente
          </div>
          <div class="text-xs text-neutral-500">
            Click su una cella per copiare il valore (formato <span class="font-mono tabular-nums">7,5</span>) — o usa i pulsanti per l'intera tabella
          </div>
        </div>
        <div class="flex items-center gap-2">
          <UButton
            size="sm"
            variant="soft"
            color="neutral"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard-copy'"
            @click="onCopy"
          >
            {{ copied ? 'Copiato' : 'Copia tabella' }}
          </UButton>
          <UButton
            size="sm"
            variant="soft"
            color="primary"
            icon="i-lucide-download"
            @click="onExport"
          >
            Esporta XLSX
          </UButton>
        </div>
      </div>
    </template>

    <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]">
      <table class="border-separate border-spacing-0 text-[13px] w-full">
        <thead>
          <tr>
            <th
              class="sticky left-0 top-0 z-30 bg-neutral-50 dark:bg-neutral-900 border-b border-r border-neutral-200 dark:border-neutral-800 px-3 py-2 text-left font-medium text-neutral-500 min-w-[200px]"
            >
              Dipendente
            </th>
            <th
              v-for="d in days"
              :key="`dow-${toIsoDate(d)}`"
              class="sticky top-0 z-20 bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 px-0 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider"
              :class="[
                isWeekendDate(d) ? 'text-neutral-400' : 'text-neutral-500',
                isHoveredCol(toIsoDate(d)) ? 'bg-primary-50 dark:bg-primary-950/40' : '',
              ]"
              :style="{ minWidth: '40px', width: '40px' }"
            >
              <div>{{ dowLetter(d) }}</div>
              <div
                class="text-[12px] mt-0.5 tabular-nums"
                :class="isWeekendDate(d) ? 'text-neutral-400' : 'text-neutral-700 dark:text-neutral-300'"
              >
                {{ d.getUTCDate() }}
              </div>
            </th>
            <th
              class="sticky top-0 right-0 z-30 bg-neutral-100 dark:bg-neutral-900 border-b border-l border-neutral-200 dark:border-neutral-800 px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 min-w-[80px]"
            >
              Totale
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="r in rows"
            :key="r.employeeId"
            :class="isHoveredRow(r.employeeId) ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''"
          >
            <td
              class="sticky left-0 z-10 border-b border-r border-neutral-100 dark:border-neutral-900 px-3 py-1.5 truncate max-w-[260px]"
              :class="isHoveredRow(r.employeeId)
                ? 'bg-primary-50 dark:bg-primary-950/40'
                : 'bg-white dark:bg-neutral-950'"
            >
              <div class="font-medium text-neutral-900 dark:text-neutral-100 truncate text-[13px]">
                {{ r.employeeName }}
              </div>
              <div v-if="r.organization" class="text-[10px] text-neutral-500 truncate">
                {{ r.organization }}
              </div>
            </td>
            <td
              v-for="d in days"
              :key="`${r.employeeId}-${toIsoDate(d)}`"
              class="border-b border-neutral-100 dark:border-neutral-900 px-1 py-1.5 text-right tabular-nums text-[14px] transition-colors select-none"
              :class="[
                isWeekendDate(d) ? 'bg-neutral-50/60 dark:bg-neutral-900/40' : '',
                isCopied(`cell|${r.employeeId}|${toIsoDate(d)}`)
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-500/60'
                  : isHovered(r.employeeId, toIsoDate(d))
                    ? 'bg-primary-100 dark:bg-primary-900/40 ring-1 ring-primary-500/40'
                    : '',
                r.byDay.get(toIsoDate(d))
                  ? 'font-semibold text-neutral-900 dark:text-neutral-50 cursor-pointer'
                  : 'text-neutral-300 dark:text-neutral-700 cursor-default',
              ]"
              :title="r.byDay.get(toIsoDate(d)) ? `${r.employeeName} · ${formatHHMM(r.byDay.get(toIsoDate(d))!)} · click per copiare` : ''"
              @mouseenter="hoveredCell = { row: r.employeeId, iso: toIsoDate(d) }"
              @mouseleave="hoveredCell = null"
              @click="copyValue(r.byDay.get(toIsoDate(d)) ?? 0, `cell|${r.employeeId}|${toIsoDate(d)}`)"
            >
              <template v-if="isCopied(`cell|${r.employeeId}|${toIsoDate(d)}`)">
                <UIcon name="i-lucide-check" class="size-3.5 text-emerald-600 dark:text-emerald-400 inline-block" />
              </template>
              <template v-else>
                {{ r.byDay.get(toIsoDate(d)) ? formatHoursIt(r.byDay.get(toIsoDate(d))!) : '·' }}
              </template>
            </td>
            <td
              class="sticky right-0 z-10 border-b border-l border-neutral-100 dark:border-neutral-900 px-3 py-1.5 text-right tabular-nums font-semibold text-[14px] text-neutral-900 dark:text-neutral-100 cursor-pointer select-none transition-colors"
              :class="isCopied(`row|${r.employeeId}`)
                ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-500/60'
                : isHoveredRow(r.employeeId)
                  ? 'bg-primary-100 dark:bg-primary-900/40'
                  : 'bg-neutral-50 dark:bg-neutral-900'"
              :title="`Totale ${r.employeeName} · click per copiare`"
              @click="copyValue(r.total, `row|${r.employeeId}`)"
            >
              <template v-if="isCopied(`row|${r.employeeId}`)">
                <UIcon name="i-lucide-check" class="size-3.5 text-emerald-600 dark:text-emerald-400 inline-block" />
              </template>
              <template v-else>
                {{ formatHoursIt(r.total) }}
              </template>
            </td>
          </tr>

          <tr v-if="rows.length === 0">
            <td :colspan="days.length + 2" class="px-6 py-12 text-center text-sm text-neutral-500">
              Nessuna ora registrata su questa commessa nel periodo.
            </td>
          </tr>
        </tbody>
        <tfoot v-if="rows.length > 0">
          <tr>
            <td
              class="sticky left-0 z-10 bg-neutral-100 dark:bg-neutral-900 border-t border-r border-neutral-200 dark:border-neutral-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-400"
            >
              Tot. giorno
            </td>
            <td
              v-for="d in days"
              :key="`foot-${toIsoDate(d)}`"
              class="bg-neutral-100 dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 px-1 py-2 text-right tabular-nums text-[12px] font-semibold transition-colors select-none"
              :class="[
                isWeekendDate(d) ? 'text-neutral-400' : 'text-neutral-700 dark:text-neutral-300',
                isCopied(`col|${toIsoDate(d)}`)
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-500/60'
                  : isHoveredCol(toIsoDate(d)) ? 'bg-primary-100 dark:bg-primary-900/40' : '',
                dayTotals.get(toIsoDate(d)) ? 'cursor-pointer' : 'cursor-default',
              ]"
              :title="dayTotals.get(toIsoDate(d)) ? `Totale giorno · click per copiare` : ''"
              @click="copyValue(dayTotals.get(toIsoDate(d)) ?? 0, `col|${toIsoDate(d)}`)"
            >
              <template v-if="isCopied(`col|${toIsoDate(d)}`)">
                <UIcon name="i-lucide-check" class="size-3.5 text-emerald-600 dark:text-emerald-400 inline-block" />
              </template>
              <template v-else>
                {{ dayTotals.get(toIsoDate(d)) ? formatHoursIt(dayTotals.get(toIsoDate(d))!) : '' }}
              </template>
            </td>
            <td
              class="sticky right-0 z-10 border-t border-l border-neutral-300 dark:border-neutral-700 px-3 py-2 text-right tabular-nums font-bold text-[14px] text-neutral-900 dark:text-neutral-50 cursor-pointer select-none transition-colors"
              :class="isCopied('grand')
                ? 'bg-emerald-100 dark:bg-emerald-900/40 ring-1 ring-emerald-500/60'
                : 'bg-neutral-200 dark:bg-neutral-800'"
              :title="`Totale generale · click per copiare`"
              @click="copyValue(grandTotal, 'grand')"
            >
              <template v-if="isCopied('grand')">
                <UIcon name="i-lucide-check" class="size-3.5 text-emerald-600 dark:text-emerald-400 inline-block" />
              </template>
              <template v-else>
                {{ formatHoursIt(grandTotal) }}
              </template>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </UCard>
</template>
