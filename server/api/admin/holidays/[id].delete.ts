import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { holidays } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

/**
 * Hard delete: le festività non hanno FK a ore (sono solo etichette
 * informative sul calendario), quindi è sicuro cancellarle.
 */
export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))

  const [row] = await useDb()
    .delete(holidays)
    .where(eq(holidays.id, id))
    .returning({ id: holidays.id })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Festività non trovata' })
  }
  return { ok: true }
})
