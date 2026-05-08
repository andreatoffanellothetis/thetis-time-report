<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDatasetStore } from '~/stores/dataset'

type ZoneKind = 'daily-breakdown' | 'project-logs'

const props = defineProps<{
  variant?: 'fullscreen' | 'compact'
}>()

const variant = computed(() => props.variant ?? 'fullscreen')

const datasetStore = useDatasetStore()

const draggingZone = ref<ZoneKind | 'compact' | null>(null)
const inputDaily = ref<HTMLInputElement | null>(null)
const inputProjectLogs = ref<HTMLInputElement | null>(null)
const inputCompact = ref<HTMLInputElement | null>(null)

const wrongTypeError = ref<string | null>(null)
const routedHint = ref<string | null>(null)

const ZONES = [
  {
    kind: 'daily-breakdown' as const,
    step: 1,
    label: 'Daily breakdown',
    fileNameHint: 'daily_breakdown',
    description: 'Per ogni giorno: orario previsto, ore registrate, anomalie.',
    icon: 'i-lucide-calendar-days',
  },
  {
    kind: 'project-logs' as const,
    step: 2,
    label: 'Foglio progetti',
    fileNameHint: 'employee_by_project_logs',
    description: 'Righe di entrata, uscita e progetto, giorno per giorno.',
    icon: 'i-lucide-folder-kanban',
  },
]

function isLoaded(kind: ZoneKind) {
  return kind === 'project-logs' ? datasetStore.hasProjectLogs : datasetStore.hasDailyBreakdown
}
function fileNameOf(kind: ZoneKind) {
  return kind === 'project-logs' ? datasetStore.projectLogsFileName : datasetStore.dailyBreakdownFileName
}

function clearMessages() {
  wrongTypeError.value = null
  routedHint.value = null
}

function onZoneDragEnter(kind: ZoneKind | 'compact', e: DragEvent) {
  e.preventDefault()
  draggingZone.value = kind
}
function onZoneDragOver(kind: ZoneKind | 'compact', e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  draggingZone.value = kind
}
function onZoneDragLeave(e: DragEvent) {
  e.preventDefault()
  draggingZone.value = null
}

function pickFirstXlsx(list: FileList | null | undefined): { ok: File } | { wrong: number } {
  const all = Array.from(list ?? [])
  if (all.length === 0) return { wrong: 0 }
  const xlsx = all.find(f => f.name.toLowerCase().endsWith('.xlsx'))
  if (!xlsx) return { wrong: all.length }
  return { ok: xlsx }
}

async function loadIntoZone(kind: ZoneKind, file: File) {
  clearMessages()
  const before = {
    logs: datasetStore.projectLogsFileName,
    daily: datasetStore.dailyBreakdownFileName,
  }
  await datasetStore.loadFile(file)
  if (datasetStore.parseError) return
  const newKind: ZoneKind | 'attendance' | null = datasetStore.projectLogsFileName !== before.logs
    ? 'project-logs'
    : datasetStore.dailyBreakdownFileName !== before.daily
      ? 'daily-breakdown'
      : 'attendance'
  if (newKind === 'attendance') {
    routedHint.value = 'Il riepilogo presenze non serve a questo strumento, l’ho ignorato.'
  } else if (newKind && newKind !== kind) {
    const labels: Record<ZoneKind, string> = {
      'daily-breakdown': 'daily breakdown',
      'project-logs': 'log progetti',
    }
    routedHint.value = `Quel file era il ${labels[newKind]}: l’ho messo io nella casella giusta.`
  }
}

async function onZoneDrop(kind: ZoneKind, e: DragEvent) {
  e.preventDefault()
  draggingZone.value = null
  const picked = pickFirstXlsx(e.dataTransfer?.files)
  if ('wrong' in picked) {
    wrongTypeError.value = picked.wrong === 0
      ? 'Non ho ricevuto nessun file. Riprova trascinandolo dentro la casella.'
      : 'Servono file Excel con estensione .xlsx. Quello che hai trascinato non lo è.'
    return
  }
  await loadIntoZone(kind, picked.ok)
}

async function onZonePick(kind: ZoneKind, e: Event) {
  const target = e.target as HTMLInputElement
  const picked = pickFirstXlsx(target.files)
  target.value = ''
  if ('wrong' in picked) {
    if (picked.wrong > 0) {
      wrongTypeError.value = 'Servono file Excel con estensione .xlsx.'
    }
    return
  }
  await loadIntoZone(kind, picked.ok)
}

function triggerZone(kind: ZoneKind) {
  if (kind === 'project-logs') inputProjectLogs.value?.click()
  else inputDaily.value?.click()
}

function removeZone(kind: ZoneKind) {
  clearMessages()
  datasetStore.clearKind(kind)
}

async function onCompactDrop(e: DragEvent) {
  e.preventDefault()
  draggingZone.value = null
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.name.toLowerCase().endsWith('.xlsx'))
  if (files.length === 0) return
  await datasetStore.loadFiles(files)
}
async function onCompactPick(e: Event) {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  if (files.length === 0) return
  await datasetStore.loadFiles(files)
  target.value = ''
}
function triggerCompact() {
  inputCompact.value?.click()
}
</script>

<template>
  <div
    v-if="variant === 'fullscreen'"
    class="fixed inset-0 z-10 overflow-y-auto bg-neutral-50 dark:bg-neutral-950"
  >
    <div class="min-h-full flex items-center justify-center p-6 sm:p-10">
      <div class="w-full max-w-5xl">
        <header class="text-center mb-10 sm:mb-12">
          <div class="flex justify-center mb-5">
            <div class="size-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center shadow-sm">
              <UIcon name="i-lucide-clock-9" class="size-7" />
            </div>
          </div>
          <h1 class="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Report presenze Thetis
          </h1>
          <p class="mt-3 text-base sm:text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto">
            Servono <span class="font-medium text-neutral-900 dark:text-neutral-100">due file Excel</span>
            esportati dal gestionale. Trascinali nelle due caselle qui sotto.
          </p>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <template v-for="z in ZONES" :key="z.kind">
            <div
              class="group relative rounded-3xl border-2 transition-all duration-200 will-change-transform motion-reduce:transition-none"
              :class="[
                isLoaded(z.kind)
                  ? 'border-solid border-primary-500/40 bg-primary-50/40 dark:bg-primary-950/20'
                  : 'border-dashed bg-white dark:bg-neutral-900',
                !isLoaded(z.kind) && draggingZone === z.kind
                  ? 'border-primary-500 bg-primary-50/60 dark:bg-primary-950/30 shadow-lg scale-[1.015] motion-reduce:scale-100'
                  : !isLoaded(z.kind)
                    ? 'border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600'
                    : '',
              ]"
              style="transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1)"
              @dragenter="onZoneDragEnter(z.kind, $event)"
              @dragover="onZoneDragOver(z.kind, $event)"
              @dragleave="onZoneDragLeave"
              @drop="onZoneDrop(z.kind, $event)"
            >
              <div class="absolute top-4 left-4 size-7 rounded-full bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center text-xs font-semibold tabular-nums">
                {{ z.step }}
              </div>

              <div v-if="!isLoaded(z.kind)" class="px-6 sm:px-8 pt-14 pb-8 text-center">
                <div class="flex justify-center mb-4">
                  <div
                    class="size-14 rounded-2xl flex items-center justify-center transition-colors duration-200 motion-reduce:transition-none"
                    :class="draggingZone === z.kind
                      ? 'bg-primary-600 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'"
                  >
                    <UIcon :name="z.icon" class="size-7" />
                  </div>
                </div>
                <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  {{ z.label }}
                </h2>
                <p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  {{ z.description }}
                </p>

                <div class="mt-5 inline-flex items-center gap-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2">
                  <UIcon name="i-lucide-file-spreadsheet" class="size-4 text-neutral-500 shrink-0" />
                  <code class="text-xs sm:text-sm font-mono text-neutral-700 dark:text-neutral-300 truncate">
                    {{ z.fileNameHint }}.xlsx
                  </code>
                </div>
                <p class="mt-2 text-xs text-neutral-500">
                  Cerca il file che <em>inizia</em> così.
                </p>

                <div class="mt-7 flex flex-col items-center gap-2">
                  <UButton
                    size="lg"
                    color="primary"
                    icon="i-lucide-upload"
                    :loading="datasetStore.isParsing"
                    @click="triggerZone(z.kind)"
                  >
                    Sfoglia il computer
                  </UButton>
                  <p class="text-xs text-neutral-500">o trascina qui il file</p>
                </div>
              </div>

              <div v-else class="px-6 sm:px-8 pt-14 pb-7">
                <div class="flex items-start gap-4">
                  <div class="size-12 rounded-2xl bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <UIcon name="i-lucide-check" class="size-6" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-700 dark:text-primary-400">
                      <span>Caricato</span>
                      <span class="text-neutral-400">·</span>
                      <span class="text-neutral-600 dark:text-neutral-400 normal-case font-normal">{{ z.label }}</span>
                    </div>
                    <div class="mt-1 text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {{ fileNameOf(z.kind) }}
                    </div>
                    <div class="mt-3 flex items-center gap-3 text-xs">
                      <button
                        type="button"
                        class="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium underline-offset-2 hover:underline"
                        @click="triggerZone(z.kind)"
                      >
                        Cambia file
                      </button>
                      <span class="text-neutral-300 dark:text-neutral-700">·</span>
                      <button
                        type="button"
                        class="text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                        @click="removeZone(z.kind)"
                      >
                        Rimuovi
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </template>
        </div>

        <input
          ref="inputDaily"
          type="file"
          accept=".xlsx"
          class="sr-only"
          @change="onZonePick('daily-breakdown', $event)"
        >
        <input
          ref="inputProjectLogs"
          type="file"
          accept=".xlsx"
          class="sr-only"
          @change="onZonePick('project-logs', $event)"
        >

        <div class="mt-6 min-h-6 space-y-2">
          <div
            v-if="datasetStore.parseError"
            class="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-4 py-3"
          >
            <UIcon name="i-lucide-alert-circle" class="size-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div class="min-w-0 text-sm">
              <div class="font-medium text-red-900 dark:text-red-200">{{ datasetStore.parseError }}</div>
              <ul v-if="datasetStore.parseDetails.length" class="mt-1 text-red-700 dark:text-red-300 space-y-0.5">
                <li v-for="d in datasetStore.parseDetails" :key="d">{{ d }}</li>
              </ul>
            </div>
          </div>

          <div
            v-else-if="wrongTypeError"
            class="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm"
          >
            <UIcon name="i-lucide-alert-triangle" class="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div class="text-amber-900 dark:text-amber-200">{{ wrongTypeError }}</div>
          </div>

          <div
            v-else-if="routedHint"
            class="flex items-start gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 text-sm"
          >
            <UIcon name="i-lucide-info" class="size-5 text-neutral-500 shrink-0 mt-0.5" />
            <div class="text-neutral-700 dark:text-neutral-300">{{ routedHint }}</div>
          </div>
        </div>

        <p class="mt-8 text-center text-xs text-neutral-500 flex items-center justify-center gap-1.5">
          <UIcon name="i-lucide-shield-check" class="size-4" />
          I file restano sul tuo computer. Niente upload, niente cloud.
        </p>
      </div>
    </div>
  </div>

  <div
    v-else
    class="flex items-center gap-2"
    @dragenter="onZoneDragEnter('compact', $event)"
    @dragover="onZoneDragOver('compact', $event)"
    @dragleave="onZoneDragLeave"
    @drop="onCompactDrop"
  >
    <UButton
      size="sm"
      variant="soft"
      icon="i-lucide-upload"
      @click="triggerCompact"
    >
      Carica nuovi file
    </UButton>
    <input
      ref="inputCompact"
      type="file"
      accept=".xlsx"
      multiple
      class="hidden"
      @change="onCompactPick"
    >
  </div>
</template>
