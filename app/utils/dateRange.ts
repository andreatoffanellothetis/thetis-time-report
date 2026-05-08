import type { IsoDate } from '~/types/domain'

export function toIsoDate(d: Date): IsoDate {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromIsoDate(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1))
}

export function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

export function eachDayInRange(start: Date, end: Date): Date[] {
  const out: Date[] = []
  const current = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  ))
  const stop = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  )
  while (current.getTime() <= stop) {
    out.push(new Date(current))
    current.setUTCDate(current.getUTCDate() + 1)
  }
  return out
}

export function workingDaysInRange(
  start: Date,
  end: Date,
  isHoliday: (d: Date) => boolean,
): number {
  let n = 0
  for (const d of eachDayInRange(start, end)) {
    if (!isWeekend(d) && !isHoliday(d)) n++
  }
  return n
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

export function formatDateLong(d: Date): string {
  return d.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatDateShort(d: Date): string {
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatPeriod(start: Date, end: Date): string {
  return `${formatDateShort(start)} – ${formatDateShort(end)}`
}
