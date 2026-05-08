import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Dataset, ParsedAttendance, ParsedDailyBreakdown, ParsedFile, ParsedProjectLogs } from '~/types/domain'
import { parseExcelFile, ExcelParseError } from '~/composables/useExcelParser'
import { buildDataset } from '~/utils/buildDataset'

export type FileKind = 'attendance' | 'project-logs' | 'daily-breakdown'

export const useDatasetStore = defineStore('dataset', () => {
  const attendance = ref<ParsedAttendance | null>(null)
  const projectLogs = ref<ParsedProjectLogs | null>(null)
  const dailyBreakdown = ref<ParsedDailyBreakdown | null>(null)
  const attendanceFileName = ref<string | null>(null)
  const projectLogsFileName = ref<string | null>(null)
  const dailyBreakdownFileName = ref<string | null>(null)

  const isParsing = ref(false)
  const parseError = ref<string | null>(null)
  const parseDetails = ref<string[]>([])

  const dataset = ref<Dataset | null>(null)
  const selectedEmployeeId = ref<string | null>(null)
  const selectedProjectId = ref<string | null>(null)
  const viewMode = ref<'employee' | 'project'>('employee')

  // niente tolleranza: ogni scostamento != 0 viene segnalato
  const thresholdMin = ref(0)

  const isReady = computed(() => dataset.value !== null)
  const hasAttendance = computed(() => attendance.value !== null)
  const hasProjectLogs = computed(() => projectLogs.value !== null)
  const hasDailyBreakdown = computed(() => dailyBreakdown.value !== null)

  const selectedEmployee = computed(() =>
    dataset.value?.employees.find(e => e.id === selectedEmployeeId.value) ?? null,
  )

  const selectedProject = computed(() =>
    dataset.value?.projects.find(p => p.id === selectedProjectId.value) ?? null,
  )

  function rebuild() {
    if (!projectLogs.value || !dailyBreakdown.value) {
      dataset.value = null
      return
    }
    try {
      dataset.value = buildDataset({
        attendance: attendance.value,
        projectLogs: projectLogs.value,
        dailyBreakdown: dailyBreakdown.value,
        thresholdMin: thresholdMin.value,
      })
    } catch (err) {
      parseError.value = err instanceof Error ? err.message : String(err)
      dataset.value = null
    }
  }

  async function loadFile(file: File) {
    isParsing.value = true
    parseError.value = null
    parseDetails.value = []
    try {
      const parsed: ParsedFile = await parseExcelFile(file)
      if (parsed.kind === 'attendance') {
        attendance.value = parsed.data
        attendanceFileName.value = file.name
      } else if (parsed.kind === 'project-logs') {
        projectLogs.value = parsed.data
        projectLogsFileName.value = file.name
      } else {
        dailyBreakdown.value = parsed.data
        dailyBreakdownFileName.value = file.name
      }
      rebuild()
    } catch (err) {
      if (err instanceof ExcelParseError) {
        parseError.value = err.message
        parseDetails.value = err.details ?? []
      } else {
        parseError.value = err instanceof Error ? err.message : String(err)
      }
    } finally {
      isParsing.value = false
    }
  }

  async function loadFiles(files: File[]) {
    for (const f of files) {
      await loadFile(f)
      if (parseError.value) return
    }
  }

  function reset() {
    attendance.value = null
    projectLogs.value = null
    dailyBreakdown.value = null
    attendanceFileName.value = null
    projectLogsFileName.value = null
    dailyBreakdownFileName.value = null
    dataset.value = null
    selectedEmployeeId.value = null
    selectedProjectId.value = null
    viewMode.value = 'employee'
    parseError.value = null
    parseDetails.value = []
  }

  function clearKind(kind: FileKind) {
    if (kind === 'attendance') {
      attendance.value = null
      attendanceFileName.value = null
    } else if (kind === 'project-logs') {
      projectLogs.value = null
      projectLogsFileName.value = null
    } else {
      dailyBreakdown.value = null
      dailyBreakdownFileName.value = null
    }
    dataset.value = null
    selectedEmployeeId.value = null
    selectedProjectId.value = null
    parseError.value = null
    parseDetails.value = []
  }

  function selectEmployee(id: string | null) {
    selectedEmployeeId.value = id
    if (id !== null) selectedProjectId.value = null
  }

  function selectProject(id: string | null) {
    selectedProjectId.value = id
    if (id !== null) selectedEmployeeId.value = null
  }

  function setViewMode(mode: 'employee' | 'project') {
    if (viewMode.value === mode) return
    viewMode.value = mode
    selectedEmployeeId.value = null
    selectedProjectId.value = null
  }

  return {
    attendance,
    projectLogs,
    dailyBreakdown,
    attendanceFileName,
    projectLogsFileName,
    dailyBreakdownFileName,
    isParsing,
    parseError,
    parseDetails,
    dataset,
    selectedEmployeeId,
    selectedProjectId,
    viewMode,
    thresholdMin,
    isReady,
    hasAttendance,
    hasProjectLogs,
    hasDailyBreakdown,
    selectedEmployee,
    selectedProject,
    loadFile,
    loadFiles,
    reset,
    clearKind,
    selectEmployee,
    selectProject,
    setViewMode,
  }
})
