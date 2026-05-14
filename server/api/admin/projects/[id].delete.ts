import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { projects } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

/**
 * Soft delete: marca `archivedAt`. Preserva FK delle ore già inserite.
 * Per riattivare, PATCH con `archivedAt: null`.
 */
export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))

  const [row] = await useDb()
    .update(projects)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Commessa non trovata' })
  }
  return row
})
