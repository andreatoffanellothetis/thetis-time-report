import { asc } from 'drizzle-orm'

import { useDb } from '~~/server/db'
import { holidays } from '~~/server/db/schema'

export default defineEventHandler(async () => {
  return useDb().select().from(holidays).orderBy(asc(holidays.date))
})
