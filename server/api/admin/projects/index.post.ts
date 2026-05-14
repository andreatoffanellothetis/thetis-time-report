import { z } from 'zod'

import { useDb } from '~~/server/db'
import { projects } from '~~/server/db/schema'

const bodySchema = z.object({
  code: z.string().min(1).max(40).trim(),
  name: z.string().min(1).max(200).trim(),
  client: z.string().max(120).trim().optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colore HEX a 6 cifre')
    .default('#64748b'),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  try {
    const [row] = await useDb()
      .insert(projects)
      .values({
        code: body.code,
        name: body.name,
        client: body.client ?? null,
        color: body.color,
      })
      .returning()
    return row
  }
  catch (e) {
    const err = e as { message?: string, code?: string }
    if (err.message?.includes('projects_code_unique') || err.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: `Codice "${body.code}" già esistente`,
      })
    }
    throw e
  }
})
