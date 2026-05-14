import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { leaveTypes } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

/** Soft delete — i tipi orario diventeranno FK delle ore inserite. */
export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))

  const [row] = await useDb()
    .update(leaveTypes)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(leaveTypes.id, id))
    .returning()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Tipo orario non trovato' })
  }
  return row
})
