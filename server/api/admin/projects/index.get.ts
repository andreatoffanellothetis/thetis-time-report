import { asc, isNull } from 'drizzle-orm'

import { useDb } from '~~/server/db'
import { projects } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeArchived = query.includeArchived === 'true'

  const db = useDb()
  const rows = await db
    .select()
    .from(projects)
    .where(includeArchived ? undefined : isNull(projects.archivedAt))
    .orderBy(asc(projects.code))

  return rows
})
