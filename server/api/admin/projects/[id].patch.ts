import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { projects } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  code: z.string().min(1).max(40).trim().optional(),
  name: z.string().min(1).max(200).trim().optional(),
  client: z.string().max(120).trim().nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** `null` per riattivare, ISO string per archiviare. */
  archivedAt: z.union([z.string().datetime(), z.null()]).optional(),
})

export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  if (body.code !== undefined) patch.code = body.code
  if (body.name !== undefined) patch.name = body.name
  if (body.client !== undefined) patch.client = body.client
  if (body.color !== undefined) patch.color = body.color
  if (body.archivedAt !== undefined) {
    patch.archivedAt = body.archivedAt ? new Date(body.archivedAt) : null
  }

  try {
    const [row] = await useDb()
      .update(projects)
      .set(patch)
      .where(eq(projects.id, id))
      .returning()

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Commessa non trovata' })
    }
    return row
  }
  catch (e) {
    const err = e as { message?: string, code?: string, statusCode?: number }
    if (err.statusCode) throw e
    if (err.message?.includes('projects_code_unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Codice già esistente' })
    }
    throw e
  }
})
