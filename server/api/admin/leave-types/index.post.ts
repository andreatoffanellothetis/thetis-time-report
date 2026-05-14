import { z } from 'zod'

import { useDb } from '~~/server/db'
import { leaveTypes } from '~~/server/db/schema'

const bodySchema = z.object({
  code: z.string().min(1).max(40).trim().regex(/^[A-Z0-9_]+$/, 'MAIUSCOLO, numeri e underscore'),
  name: z.string().min(1).max(120).trim(),
  paid: z.boolean().default(true),
  countsTowardsHours: z.boolean().default(false),
  requiresApproval: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#94a3b8'),
  maxDaysPerYear: z.number().int().positive().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))

  try {
    const [row] = await useDb()
      .insert(leaveTypes)
      .values({
        code: body.code,
        name: body.name,
        paid: body.paid,
        countsTowardsHours: body.countsTowardsHours,
        requiresApproval: body.requiresApproval,
        color: body.color,
        maxDaysPerYear: body.maxDaysPerYear ?? null,
      })
      .returning()
    return row
  }
  catch (e) {
    const err = e as { message?: string, code?: string }
    if (err.message?.includes('leave_types_code_unique') || err.code === '23505') {
      throw createError({ statusCode: 409, statusMessage: `Codice "${body.code}" già esistente` })
    }
    throw e
  }
})
