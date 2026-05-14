import { and, desc, eq, gte, lte, sql, sum } from 'drizzle-orm'

import { useDb } from '~~/server/db'
import { projects, timeEntries } from '~~/server/db/schema'
import { requireAuth } from '~~/server/utils/auth'

/* ------------------------ utility date (Europe/Rome) ------------------------ */

/** Lunedì della settimana corrente, YYYY-MM-DD. */
function weekStart(d = new Date()): string {
  const x = new Date(d)
  const day = x.getDay() // 0=Dom, 1=Lun, ...
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x.toISOString().slice(0, 10)
}

/** Primo del mese corrente, YYYY-MM-DD. */
function monthStart(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/* -------------------------------- handler -------------------------------- */

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const db = useDb()

  const todayStr = today()
  const weekFrom = weekStart()
  const monthFrom = monthStart()
  const last30From = daysAgo(30)

  // Totali su intervalli (sum durata in minuti)
  const [totals] = await db
    .select({
      week: sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.date} >= ${weekFrom} THEN ${timeEntries.durationMinutes} ELSE 0 END), 0)::int`,
      month: sql<number>`COALESCE(SUM(CASE WHEN ${timeEntries.date} >= ${monthFrom} THEN ${timeEntries.durationMinutes} ELSE 0 END), 0)::int`,
      last30: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .where(and(
      eq(timeEntries.userId, user.id),
      gte(timeEntries.date, last30From),
      lte(timeEntries.date, todayStr),
    ))

  // Top 5 commesse per minuti negli ultimi 30 giorni
  const topProjects = await db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      color: projects.color,
      minutes: sql<number>`COALESCE(SUM(${timeEntries.durationMinutes}), 0)::int`,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .where(and(
      eq(timeEntries.userId, user.id),
      gte(timeEntries.date, last30From),
      lte(timeEntries.date, todayStr),
    ))
    .groupBy(projects.id, projects.code, projects.name, projects.color)
    .orderBy(desc(sum(timeEntries.durationMinutes)))
    .limit(5)

  return {
    weekMinutes: totals?.week ?? 0,
    monthMinutes: totals?.month ?? 0,
    last30Minutes: totals?.last30 ?? 0,
    topProjects,
  }
})
