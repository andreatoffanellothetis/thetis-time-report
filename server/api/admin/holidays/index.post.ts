import { z } from 'zod'

import { useDb } from '~~/server/db'
import { holidays } from '~~/server/db/schema'

const bodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato YYYY-MM-DD'),
  name: z.string().min(1).max(120).trim(),
  recurring: z.boolean().default(false),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  const [row] = await useDb()
    .insert(holidays)
    .values({
      date: body.date,
      name: body.name,
      recurring: body.recurring,
    })
    .returning()
  return row
})
