import type {
  Dataset,
  DayEntry,
  DayKind,
  DayLog,
  DayStatus,
  DatasetWarning,
  Employee,
  IsoDate,
  Minutes,
  ParsedAttendance,
  ParsedDailyBreakdown,
  ParsedProjectLogs,
  Period,
  Project,
  ProjectBreakdown,
} from '~/types/domain'
import { useItalianHolidays } from '~/composables/useItalianHolidays'
import { useProjectColors } from '~/composables/useProjectColors'
import { eachDayInRange, fromIsoDate, isWeekend, toIsoDate, workingDaysInRange } from '~/utils/dateRange'

export interface BuildDatasetInput {
  attendance: ParsedAttendance | null
  projectLogs: ParsedProjectLogs
  dailyBreakdown: ParsedDailyBreakdown
  thresholdMin: number
}

const PROJECT_NAME_RE = /^\s*(\d+)\s*[-–]\s*(.+)$/

function deriveProjectShortName(name: string): { code: string; shortName: string } {
  const m = name.match(PROJECT_NAME_RE)
  if (m) return { code: m[1]!, shortName: m[2]!.trim() }
  return { code: '', shortName: name }
}

const LEAVE_TOKENS = [
  'permesso',
  'ferie',
  'malattia',
  'maternit',
  'congedo',
  'donazione',
  'rol',
  'recupero',
]

export function classifyDayKind(label: string): DayKind {
  const l = label.toLowerCase().trim()
  if (!l) return 'unknown'
  if (l.includes('festivo')) return 'holiday'
  if (l.includes('giorno libero')) return 'day-off'
  const hasLeave = LEAVE_TOKENS.some(t => l.includes(t))
  const hasSchedule = l.includes('flessibile') || l.includes('rigido') || /\bturno\b/.test(l)
  if (hasLeave && hasSchedule) return 'workday-with-leave'
  if (hasLeave) return 'leave-full'
  if (hasSchedule) return 'workday'
  return 'unknown'
}

function classifyStatus(
  totalMin: Minutes,
  expectedMin: Minutes,
  kind: DayKind,
  thresholdMin: number,
): DayStatus {
  if (kind === 'holiday') return 'holiday'
  if (kind === 'day-off') return 'weekend'
  if (kind === 'leave-full') return 'leave'
  if (expectedMin === 0 && totalMin === 0) return 'weekend'
  if (totalMin === 0 && expectedMin > 0) return 'absent'
  const variance = totalMin - expectedMin
  if (Math.abs(variance) <= thresholdMin) return 'ok'
  return variance < 0 ? 'under' : 'over'
}

export function buildDataset(input: BuildDatasetInput): Dataset {
  const { attendance, projectLogs: logs, dailyBreakdown, thresholdMin } = input
  const warnings: DatasetWarning[] = [
    ...(attendance?.warnings ?? []),
    ...logs.warnings,
    ...dailyBreakdown.warnings,
  ]
  const { isHoliday } = useItalianHolidays()
  const colors = useProjectColors()

  // Periodo: usiamo il range del daily_breakdown come fonte di verità.
  const periodStart = dailyBreakdown.periodStart ?? logs.periodStart
  const periodEnd = dailyBreakdown.periodEnd ?? logs.periodEnd
  if (!periodStart || !periodEnd) {
    throw new Error('Nessuna data valida nei file caricati')
  }
  const start = fromIsoDate(periodStart)
  const end = fromIsoDate(periodEnd)
  const period: Period = {
    start,
    end,
    workingDays: workingDaysInRange(start, end, isHoliday),
  }

  // Progetti dalla file project-logs
  const projectMap = new Map<string, Project>()
  for (const r of logs.rows) {
    if (projectMap.has(r.projectId)) continue
    const { code, shortName } = deriveProjectShortName(r.projectName)
    projectMap.set(r.projectId, {
      id: r.projectId,
      name: r.projectName,
      code,
      shortName,
      color: colors.colorFor(r.projectId),
    })
  }
  const projects = Array.from(projectMap.values()).sort((a, b) =>
    a.shortName.localeCompare(b.shortName, 'it'),
  )

  // Indicizzo daily_breakdown per (employeeId, isoDate)
  const dailyByEmployee = new Map<string, Map<IsoDate, typeof dailyBreakdown.rows[number]>>()
  const employeeNames = new Map<string, string>()
  for (const d of dailyBreakdown.rows) {
    let perDate = dailyByEmployee.get(d.employeeId)
    if (!perDate) {
      perDate = new Map()
      dailyByEmployee.set(d.employeeId, perDate)
    }
    perDate.set(d.date, d)
    if (!employeeNames.has(d.employeeId)) employeeNames.set(d.employeeId, d.employeeName)
  }

  // Indicizzo attendance per id (per organizzazione e dati ausiliari)
  const attendanceById = new Map<string, typeof attendance extends null ? never : NonNullable<typeof attendance>['rows'][number]>()
  if (attendance) {
    for (const a of attendance.rows) attendanceById.set(a.employeeId, a)
  }

  // Indicizzo project logs per (employeeId, isoDate)
  const logsByEmployeeDate = new Map<string, Map<IsoDate, typeof logs.rows>>()
  for (const r of logs.rows) {
    let perDate = logsByEmployeeDate.get(r.employeeId)
    if (!perDate) {
      perDate = new Map<IsoDate, typeof logs.rows>()
      logsByEmployeeDate.set(r.employeeId, perDate)
    }
    const arr = perDate.get(r.date) ?? []
    arr.push(r)
    perDate.set(r.date, arr)
  }

  const employeeIds = new Set<string>([
    ...dailyByEmployee.keys(),
    ...logsByEmployeeDate.keys(),
    ...attendanceById.keys(),
  ])

  const allDays = eachDayInRange(start, end)
  const employees: Employee[] = []

  for (const employeeId of employeeIds) {
    const perDate = dailyByEmployee.get(employeeId)
    const att = attendanceById.get(employeeId)
    const empLogs = logsByEmployeeDate.get(employeeId)
    const name = employeeNames.get(employeeId) ?? att?.employeeName ?? 'Sconosciuto'

    if (!perDate) {
      warnings.push({
        kind: 'employee-only-in-logs',
        message: `${name}: presente nei log ma non nel daily breakdown`,
        meta: { employeeId },
      })
    }

    const daily = new Map<IsoDate, DayLog>()
    let totalLogged = 0
    let totalExpected = 0
    let totalRegisteredAttendance = 0
    let daysWithLog = 0
    let workingDaysForEmployee = 0
    const projectTotals = new Map<string, { totalMin: Minutes; days: Set<IsoDate> }>()

    for (const d of allDays) {
      const iso = toIsoDate(d)
      const dailyRow = perDate?.get(iso) ?? null
      const wk = isWeekend(d)
      const hl = isHoliday(d)
      const scheduledLabel = dailyRow?.scheduledLabel ?? ''
      const kind = dailyRow ? classifyDayKind(scheduledLabel) : (hl ? 'holiday' : wk ? 'day-off' : 'unknown')
      const expectedMin = dailyRow?.scheduledMin ?? 0
      const registeredMin = dailyRow?.registeredMin ?? 0

      const dayProjectRows = empLogs?.get(iso) ?? []
      const entries: DayEntry[] = dayProjectRows.map(r => ({
        project: projectMap.get(r.projectId)!,
        startMin: r.startMin,
        endMin: r.endMin,
        durationMin: r.durationMin,
      })).sort((a, b) => a.startMin - b.startMin)

      const totalMin = entries.reduce((s, e) => s + e.durationMin, 0)
      if (totalMin > 0) daysWithLog++
      totalLogged += totalMin
      totalExpected += expectedMin
      totalRegisteredAttendance += registeredMin
      if (expectedMin > 0) workingDaysForEmployee++

      for (const r of dayProjectRows) {
        const pt = projectTotals.get(r.projectId) ?? { totalMin: 0, days: new Set<IsoDate>() }
        pt.totalMin += r.durationMin
        pt.days.add(iso)
        projectTotals.set(r.projectId, pt)
      }

      const status = classifyStatus(totalMin, expectedMin, kind, thresholdMin)

      daily.set(iso, {
        date: d,
        isoDate: iso,
        isWeekend: wk,
        isHoliday: hl,
        kind,
        scheduledLabel,
        entries,
        totalMin,
        expectedMin,
        registeredMin,
        varianceMin: totalMin - expectedMin,
        status,
        anomaly: dailyRow?.anomaly ?? null,
      })
    }

    const expectedPerDay = workingDaysForEmployee > 0
      ? Math.round(totalExpected / workingDaysForEmployee)
      : 0

    const variance = totalLogged - totalExpected
    const variancePct = totalExpected > 0 ? variance / totalExpected : 0

    const breakdown: ProjectBreakdown[] = []
    for (const [projectId, agg] of projectTotals) {
      const project = projectMap.get(projectId)!
      breakdown.push({
        project,
        totalMin: agg.totalMin,
        pct: totalLogged > 0 ? agg.totalMin / totalLogged : 0,
        daysCount: agg.days.size,
      })
    }
    breakdown.sort((a, b) => b.totalMin - a.totalMin)

    employees.push({
      id: employeeId,
      name,
      organization: att?.organization ?? '',
      monthlyExpected: totalExpected,
      monthlyExpectedFull: totalExpected,
      expectedDays: workingDaysForEmployee,
      expectedPerDay,
      dailyExpected: expectedPerDay,
      monthlyRegisteredAttendance: totalRegisteredAttendance,
      monthlyLogged: totalLogged,
      variance,
      variancePct,
      varianceFull: variance,
      variancePctFull: variancePct,
      absenceDays: att?.absenceDays ?? 0,
      absenceMin: att?.absenceMin ?? 0,
      daysAnomaly: att?.daysAnomaly ?? Array.from(daily.values()).filter(d => d.anomaly && d.kind !== 'holiday' && d.kind !== 'day-off').length,
      daysWithLog,
      daily,
      projectBreakdown: breakdown,
    })
  }

  employees.sort((a, b) => {
    if (a.variancePct !== b.variancePct) return a.variancePct - b.variancePct
    return a.name.localeCompare(b.name, 'it')
  })

  let expected = 0
  let expectedFull = 0
  let logged = 0
  let employeesOutOfThreshold = 0
  let employeesWithImpliedAbsences = 0
  for (const e of employees) {
    expected += e.monthlyExpected
    expectedFull += e.monthlyExpectedFull
    logged += e.monthlyLogged
    if (Math.abs(e.varianceFull) > thresholdMin) {
      employeesOutOfThreshold++
    }
    if (e.absenceDays > 0 && e.absenceMin < e.absenceDays * e.expectedPerDay) {
      employeesWithImpliedAbsences++
    }
  }

  const variance = logged - expected
  const variancePct = expected > 0 ? variance / expected : 0

  return {
    period,
    employees,
    projects,
    totals: {
      expected,
      expectedFull,
      logged,
      variance,
      variancePct,
      varianceFull: variance,
      variancePctFull: variancePct,
      employeesOutOfThreshold,
      employeesWithImpliedAbsences,
    },
    warnings,
  }
}
