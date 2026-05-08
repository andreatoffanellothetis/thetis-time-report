import { toIsoDate } from '~/utils/dateRange'

const FIXED_HOLIDAYS: Array<[number, number]> = [
  [1, 1],   // Capodanno
  [1, 6],   // Epifania
  [4, 25],  // Liberazione
  [5, 1],   // Festa del lavoro
  [6, 2],   // Festa della Repubblica
  [8, 15],  // Ferragosto
  [11, 1],  // Ognissanti
  [12, 8],  // Immacolata
  [12, 25], // Natale
  [12, 26], // Santo Stefano
]

function easterMonday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  const easter = new Date(Date.UTC(year, month - 1, day))
  easter.setUTCDate(easter.getUTCDate() + 1)
  return easter
}

export function useItalianHolidays() {
  const cache = new Map<number, Set<string>>()

  function getYearSet(year: number): Set<string> {
    let set = cache.get(year)
    if (set) return set
    set = new Set<string>()
    for (const [m, d] of FIXED_HOLIDAYS) {
      set.add(toIsoDate(new Date(Date.UTC(year, m - 1, d))))
    }
    set.add(toIsoDate(easterMonday(year)))
    cache.set(year, set)
    return set
  }

  function isHoliday(date: Date): boolean {
    return getYearSet(date.getUTCFullYear()).has(toIsoDate(date))
  }

  return { isHoliday }
}
