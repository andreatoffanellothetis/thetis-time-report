import type { Minutes } from '~/types/domain'

const HHMM_RE = /^(-?)(\d+):(\d{2})$/

export function parseHHMM(value: unknown): Minutes {
  if (value == null || value === '') return 0
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 0 && value < 1) {
      return Math.round(value * 24 * 60)
    }
    return Math.round(value)
  }
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes()
  }
  const str = String(value).trim()
  const match = HHMM_RE.exec(str)
  if (match) {
    const sign = match[1] === '-' ? -1 : 1
    const hours = Number(match[2])
    const minutes = Number(match[3])
    return sign * (hours * 60 + minutes)
  }
  const num = Number(str)
  if (Number.isFinite(num)) return Math.round(num)
  return 0
}

export function formatHHMM(min: Minutes): string {
  const sign = min < 0 ? '-' : ''
  const abs = Math.abs(Math.round(min))
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return `${sign}${h}:${String(m).padStart(2, '0')}`
}

export function formatSignedHHMM(min: Minutes): string {
  if (min === 0) return '0:00'
  if (min > 0) return `+${formatHHMM(min)}`
  return formatHHMM(min)
}

export function formatHoursDecimal(min: Minutes, fractionDigits = 1): string {
  return (min / 60).toFixed(fractionDigits)
}

export function formatHoursIt(min: Minutes, opts?: { emptyOnZero?: boolean }): string {
  if (min === 0) return opts?.emptyOnZero ? '' : '0'
  const hours = min / 60
  const fixed = hours.toFixed(2)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return trimmed.replace('.', ',')
}

export function timeToMinutesOfDay(value: unknown): number {
  if (value == null || value === '') return 0
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes()
  }
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) return Math.round(value * 24 * 60)
    return Math.round(value)
  }
  return parseHHMM(value)
}
