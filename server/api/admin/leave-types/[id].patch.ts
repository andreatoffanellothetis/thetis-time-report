import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '~~/server/db'
import { leaveTypes } from '~~/server/db/schema'

const paramsSchema = z.object({ id: z.string().uuid() })

const bodySchema = z.object({
  code: z.string().min(1).max(40).trim().regex(/^[A-Z0-9_]+$/).optional(),
  name: z.string().min(1).max(120).trim().optional(),
  paid: z.boolean().optional(),
  countsTowardsHours: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  maxDaysPerYear: z.number().int().positive().nullable().optional(),
  archivedAt: z.union([z.string().datetime(), z.null()]).optional(),
})

export default defineEventHandler(async (event) => {
  const { id } = paramsSchema.parse(getRouterParams(event))
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  for (const key of ['code', 'name', 'paid', 'countsTowardsHours', 'requiresApproval', 'color', 'maxDaysPerYear'] as const) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (body.archivedAt !== undefined) {
    patch.archivedAt = body.archivedAt ? new Date(body.archivedAt) : null
  }

  try {
    const [row] = await useDb()
      .update(leaveTypes)
      .set(patch)
      .where(eq(leaveTypes.id, id))
      .returning()

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Tipo orario non trovato' })
    }
    return row
  }
  catch (e) {
    const err = e as { message?: string, code?: string, statusCode?: number }
    if (err.statusCode) throw e
    if (err.message?.includes('leave_types_code_unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: 'Codice già esistente' })
    }
    throw e
  }
})
