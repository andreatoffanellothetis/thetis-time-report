export type Minutes = number
export type IsoDate = string

export interface Period {
  start: Date
  end: Date
  workingDays: number
}

export interface Project {
  id: string
  name: string
  code: string
  shortName: string
  color: string
}

export interface DayEntry {
  project: Project
  startMin: number
  endMin: number
  durationMin: Minutes
}

export type DayStatus =
  | 'ok'
  | 'under'
  | 'over'
  | 'absent'
  | 'weekend'
  | 'holiday'
  | 'leave'

export type DayKind =
  | 'workday'
  | 'workday-with-leave'
  | 'day-off'
  | 'holiday'
  | 'leave-full'
  | 'unknown'

export interface DayLog {
  date: Date
  isoDate: IsoDate
  isWeekend: boolean
  isHoliday: boolean
  kind: DayKind
  scheduledLabel: string
  entries: DayEntry[]
  totalMin: Minutes
  expectedMin: Minutes
  registeredMin: Minutes
  varianceMin: Minutes
  status: DayStatus
  anomaly: string | null
}

export interface ProjectBreakdown {
  project: Project
  totalMin: Minutes
  pct: number
  daysCount: number
}

export interface Employee {
  id: string
  name: string
  organization: string
  monthlyExpected: Minutes
  monthlyExpectedFull: Minutes
  expectedDays: number
  expectedPerDay: Minutes
  dailyExpected: Minutes
  monthlyRegisteredAttendance: Minutes
  monthlyLogged: Minutes
  variance: Minutes
  variancePct: number
  varianceFull: Minutes
  variancePctFull: number
  absenceDays: number
  absenceMin: Minutes
  daysAnomaly: number
  daysWithLog: number
  daily: Map<IsoDate, DayLog>
  projectBreakdown: ProjectBreakdown[]
}

export interface DatasetTotals {
  expected: Minutes
  expectedFull: Minutes
  logged: Minutes
  variance: Minutes
  variancePct: number
  varianceFull: Minutes
  variancePctFull: number
  employeesOutOfThreshold: number
  employeesWithImpliedAbsences: number
}

export type WarningKind =
  | 'employee-only-in-attendance'
  | 'employee-only-in-logs'
  | 'period-mismatch'
  | 'expected-days-zero'
  | 'parse-warning'

export interface DatasetWarning {
  kind: WarningKind
  message: string
  meta?: Record<string, unknown>
}

export interface Dataset {
  period: Period
  employees: Employee[]
  projects: Project[]
  totals: DatasetTotals
  warnings: DatasetWarning[]
}

export interface RawAttendanceRow {
  employeeId: string
  employeeName: string
  organization: string
  monthlyExpectedMin: Minutes
  contractualMaxMin: Minutes
  expectedDays: number
  registeredMin: Minutes
  daysAnomaly: number
  daysWithRegistration: number
  unjustifiedMin: Minutes
  absenceDays: number
  absenceMin: Minutes
}

export interface RawProjectLogRow {
  employeeId: string
  employeeName: string
  date: IsoDate
  startMin: number
  endMin: number
  durationMin: Minutes
  projectId: string
  projectName: string
}

export interface ParsedAttendance {
  rows: RawAttendanceRow[]
  warnings: DatasetWarning[]
}

export interface ParsedProjectLogs {
  rows: RawProjectLogRow[]
  periodStart: IsoDate | null
  periodEnd: IsoDate | null
  warnings: DatasetWarning[]
}

export interface RawDailyBreakdownRow {
  date: IsoDate
  employeeId: string
  employeeName: string
  scheduledLabel: string
  registeredRanges: string
  anomaly: string | null
  scheduledMin: Minutes
  registeredMin: Minutes
}

export interface ParsedDailyBreakdown {
  rows: RawDailyBreakdownRow[]
  periodStart: IsoDate | null
  periodEnd: IsoDate | null
  warnings: DatasetWarning[]
}

export type ParsedFile =
  | { kind: 'attendance'; data: ParsedAttendance }
  | { kind: 'project-logs'; data: ParsedProjectLogs }
  | { kind: 'daily-breakdown'; data: ParsedDailyBreakdown }
