import { and, asc, desc, eq, gte, inArray, lte, type SQL } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { leaveTypes, projects, timeEntries, users } from '~~/server/db/schema'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
  projectId: z.union([z.string().uuid(), z.array(z.string().uuid())]).optional(),
  limit: z.coerce.number().int().min(1).max(2000).default(500),
})

export default defineEventHandler(async (event) => {
  const q = querySchema.parse(getQuery(event))

  const db = useDb()
  const filters: SQL[] = []
  if (q.from) filters.push(gte(timeEntries.date, q.from))
  if (q.to) filters.push(lte(timeEntries.date, q.to))
  if (q.userId) {
    filters.push(inArray(timeEntries.userId, Array.isArray(q.userId) ? q.userId : [q.userId]))
  }
  if (q.projectId) {
    filters.push(inArray(timeEntries.projectId, Array.isArray(q.projectId) ? q.projectId : [q.projectId]))
  }

  const rows = await db
    .select({
      id: timeEntries.id,
      date: timeEntries.date,
      startTime: timeEntries.startTime,
      endTime: timeEntries.endTime,
      durationMinutes: timeEntries.durationMinutes,
      comment: timeEntries.comment,
      source: timeEntries.source,
      user: {
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      },
      project: {
        id: projects.id,
        code: projects.code,
        name: projects.name,
        color: projects.color,
      },
      leaveType: {
        id: leaveTypes.id,
        code: leaveTypes.code,
        name: leaveTypes.name,
        color: leaveTypes.color,
      },
    })
    .from(timeEntries)
    .innerJoin(users, eq(users.id, timeEntries.userId))
    .leftJoin(projects, eq(projects.id, timeEntries.projectId))
    .leftJoin(leaveTypes, eq(leaveTypes.id, timeEntries.leaveTypeId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(timeEntries.date), asc(timeEntries.startTime), asc(users.displayName))
    .limit(q.limit)

  return rows
})
