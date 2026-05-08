import ExcelJS from 'exceljs'
import type {
  ParsedAttendance,
  ParsedFile,
  ParsedProjectLogs,
  ParsedDailyBreakdown,
  RawAttendanceRow,
  RawProjectLogRow,
  RawDailyBreakdownRow,
  DatasetWarning,
} from '~/types/domain'
import { parseHHMM, timeToMinutesOfDay } from '~/utils/minutes'
import { toIsoDate } from '~/utils/dateRange'

const ATTENDANCE_REQUIRED = [
  'Numero ID dipendente',
  'Dipendente',
  'Ore programmate - Totale',
  'Ore registrate - Totale',
  'Giorni - Previsti',
]

const LOGS_REQUIRED = [
  'Numero ID dipendente',
  'Dipendente',
  'Data',
  'Entrata',
  'Uscita',
  'Durata',
  'ID progetto',
  'Progetto',
]

const DAILY_REQUIRED = [
  'Data',
  'Numero ID dipendente',
  'Dipendente',
  'Orario - Previsto',
  'Bilancio - Programmato',
]

export class ExcelParseError extends Error {
  constructor(message: string, public details?: string[]) {
    super(message)
    this.name = 'ExcelParseError'
  }
}

interface SheetData {
  headers: string[]
  rows: Array<Record<string, unknown>>
}

async function readFirstSheet(buffer: ArrayBuffer): Promise<SheetData> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new ExcelParseError('Nessun foglio trovato nel file')

  // Il file daily_breakdown ha 2 righe di header: la prima con i nomi tecnici
  // (date, employee_id...), la seconda con i nomi italiani che usiamo.
  // Riconosciamo questo caso e usiamo la riga 2 come header.
  const row1: string[] = []
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    row1[colNumber - 1] = String(cell.value ?? '').trim()
  })
  const isDailyBreakdownTwoRowHeader = row1.includes('date')
    && row1.includes('employee_id')
    && row1.includes('expected_ranges')

  const headerRowIndex = isDailyBreakdownTwoRowHeader ? 2 : 1
  const dataStartIndex = headerRowIndex + 1

  const headers: string[] = []
  ws.getRow(headerRowIndex).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? '').trim()
  })

  const rows: Array<Record<string, unknown>> = []
  for (let r = dataStartIndex; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const obj: Record<string, unknown> = {}
    let hasAny = false
    for (let c = 1; c <= headers.length; c++) {
      const key = headers[c - 1]
      if (!key) continue
      const cell = row.getCell(c)
      const v = cell.value
      let resolved: unknown = v
      if (v && typeof v === 'object' && 'result' in (v as object)) {
        resolved = (v as { result: unknown }).result
      } else if (v && typeof v === 'object' && 'text' in (v as object)) {
        resolved = (v as { text: unknown }).text
      }
      if (resolved !== null && resolved !== undefined && resolved !== '') hasAny = true
      obj[key] = resolved
    }
    if (hasAny) rows.push(obj)
  }
  return { headers, rows }
}

function detectKind(headers: string[]): 'attendance' | 'project-logs' | 'daily-breakdown' | null {
  const set = new Set(headers)
  if (DAILY_REQUIRED.every(h => set.has(h))) return 'daily-breakdown'
  if (LOGS_REQUIRED.every(h => set.has(h))) return 'project-logs'
  if (ATTENDANCE_REQUIRED.every(h => set.has(h))) return 'attendance'
  return null
}

function missingColumns(headers: string[], required: string[]): string[] {
  const set = new Set(headers)
  return required.filter(h => !set.has(h))
}

function parseAttendance(sheet: SheetData): ParsedAttendance {
  const warnings: DatasetWarning[] = []
  const rows: RawAttendanceRow[] = []
  for (const r of sheet.rows) {
    const id = r['Numero ID dipendente']
    const name = r['Dipendente']
    if (!id || !name) continue
    const expectedDays = Number(r['Giorni - Previsti'] ?? 0) || 0
    const monthlyExpectedMin = parseHHMM(r['Ore programmate - Totale'])
    const contractualMaxMin = parseHHMM(r['Ore contrattuali - Massime effettive'])
    const registeredMin = parseHHMM(r['Ore registrate - Totale'])
    const unjustifiedMin = parseHHMM(r['Ore non giustificate - Totale'])
    const daysAnomaly = Number(r['Giorni - Con anomalie'] ?? 0) || 0
    const daysWithRegistration = Number(r['Giorni - Con registrazione'] ?? 0) || 0
    const absenceDays = Number(r['Assenze - Giorni'] ?? 0) || 0
    const absenceMin = parseHHMM(r['Assenze - Ore'])
    rows.push({
      employeeId: String(id),
      employeeName: String(name),
      organization: String(r['Organizzazioni del dipendente'] ?? '').trim(),
      monthlyExpectedMin,
      contractualMaxMin,
      expectedDays,
      registeredMin,
      daysAnomaly,
      daysWithRegistration,
      unjustifiedMin,
      absenceDays,
      absenceMin,
    })
  }
  return { rows, warnings }
}

function parseProjectLogs(sheet: SheetData): ParsedProjectLogs {
  const warnings: DatasetWarning[] = []
  const rows: RawProjectLogRow[] = []
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const r of sheet.rows) {
    const id = r['Numero ID dipendente']
    const name = r['Dipendente']
    const dateRaw = r['Data']
    const projectId = r['ID progetto']
    const projectName = r['Progetto']
    if (!id || !name || !dateRaw || !projectId) continue

    let date: Date
    if (dateRaw instanceof Date) date = dateRaw
    else if (typeof dateRaw === 'number') date = new Date(Math.round((dateRaw - 25569) * 86400 * 1000))
    else date = new Date(String(dateRaw))
    if (isNaN(date.getTime())) continue

    const iso = toIsoDate(date)
    if (!minDate || iso < minDate) minDate = iso
    if (!maxDate || iso > maxDate) maxDate = iso

    const startMin = timeToMinutesOfDay(r['Entrata'])
    const endMin = timeToMinutesOfDay(r['Uscita'])
    const durationMin = parseHHMM(r['Durata'])

    rows.push({
      employeeId: String(id),
      employeeName: String(name),
      date: iso,
      startMin,
      endMin: endMin > 0 ? endMin : startMin + durationMin,
      durationMin,
      projectId: String(projectId),
      projectName: String(projectName ?? '').trim(),
    })
  }

  return { rows, periodStart: minDate, periodEnd: maxDate, warnings }
}

function parseDailyBreakdown(sheet: SheetData): ParsedDailyBreakdown {
  const warnings: DatasetWarning[] = []
  const rows: RawDailyBreakdownRow[] = []
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const r of sheet.rows) {
    const id = r['Numero ID dipendente']
    const name = r['Dipendente']
    const dateRaw = r['Data']
    if (!id || !name || !dateRaw) continue

    let date: Date
    if (dateRaw instanceof Date) date = dateRaw
    else if (typeof dateRaw === 'number') date = new Date(Math.round((dateRaw - 25569) * 86400 * 1000))
    else date = new Date(String(dateRaw))
    if (isNaN(date.getTime())) continue

    const iso = toIsoDate(date)
    if (!minDate || iso < minDate) minDate = iso
    if (!maxDate || iso > maxDate) maxDate = iso

    const scheduledLabel = String(r['Orario - Previsto'] ?? '').trim()
    const registeredRanges = String(r['Orario - Registrato'] ?? '').trim()
    const anomalyRaw = r['Anomalie']
    const anomaly = anomalyRaw == null || anomalyRaw === '' ? null : String(anomalyRaw)
    const scheduledMin = parseHHMM(r['Bilancio - Programmato'])
    const registeredMin = parseHHMM(r['Stato patrimoniale - Registrato'])

    rows.push({
      date: iso,
      employeeId: String(id),
      employeeName: String(name),
      scheduledLabel,
      registeredRanges,
      anomaly,
      scheduledMin,
      registeredMin,
    })
  }

  return { rows, periodStart: minDate, periodEnd: maxDate, warnings }
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer()
  let sheet: SheetData
  try {
    sheet = await readFirstSheet(buffer)
  } catch (err) {
    throw new ExcelParseError(
      `Impossibile leggere il file ${file.name}`,
      [err instanceof Error ? err.message : String(err)],
    )
  }

  const kind = detectKind(sheet.headers)
  if (kind === 'daily-breakdown') {
    return { kind: 'daily-breakdown', data: parseDailyBreakdown(sheet) }
  }
  if (kind === 'project-logs') {
    return { kind: 'project-logs', data: parseProjectLogs(sheet) }
  }
  if (kind === 'attendance') {
    return { kind: 'attendance', data: parseAttendance(sheet) }
  }

  const missingForAttendance = missingColumns(sheet.headers, ATTENDANCE_REQUIRED)
  const missingForLogs = missingColumns(sheet.headers, LOGS_REQUIRED)
  const missingForDaily = missingColumns(sheet.headers, DAILY_REQUIRED)
  throw new ExcelParseError(
    `Il file ${file.name} non corrisponde a nessuno dei formati attesi`,
    [
      `Mancano per "presenze": ${missingForAttendance.join(', ') || 'nessuna'}`,
      `Mancano per "log progetti": ${missingForLogs.join(', ') || 'nessuna'}`,
      `Mancano per "daily breakdown": ${missingForDaily.join(', ') || 'nessuna'}`,
    ],
  )
}

export function useExcelParser() {
  return { parseExcelFile, ExcelParseError }
}
