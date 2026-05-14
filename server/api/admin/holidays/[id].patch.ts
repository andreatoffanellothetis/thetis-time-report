import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { holidays } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  name: z.string().min(1).max(120).trim().optional(),
  recurring: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  const [row] = await useDb()
    .update(holidays)
    .set(body)
    .where(eq(holidays.id, id))
    .returning()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Festività non trovata' })
  }
  return row
})
