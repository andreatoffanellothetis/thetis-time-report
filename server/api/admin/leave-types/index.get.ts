import { asc, isNull } from 'drizzle-orm'

import { useDb } from '~~/server/db'
import { leaveTypes } from '~~/server/db/schema'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const includeArchived = query.includeArchived === 'true'

  return useDb()
    .select()
    .from(leaveTypes)
    .where(includeArchived ? undefined : isNull(leaveTypes.archivedAt))
    .orderBy(asc(leaveTypes.code))
})
