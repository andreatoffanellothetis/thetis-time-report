/**
 * Stub di login per sviluppo: dato `{ email, displayName?, roles[] }` crea o
 * recupera l'utente, gli applica i ruoli richiesti, apre una sessione.
 *
 * In produzione è disabilitato a meno di `NUXT_ALLOW_DEV_LOGIN=true`
 * (settare manualmente sui preview Vercel finché non arriva Microsoft SSO).
 */

import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { useDb } from '../../db'
import { userRoleEnum, userRoles, users } from '../../db/schema'
import { isDevLoginEnabled } from '../../utils/auth'

const bodySchema = z.object({
  email: z.string().email().toLowerCase(),
  displayName: z.string().min(1).max(120).optional(),
  roles: z
    .array(z.enum(userRoleEnum.enumValues))
    .min(1, 'almeno un ruolo')
    .max(3),
})

export default defineEventHandler(async (event) => {
  if (!isDevLoginEnabled()) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Endpoint non disponibile',
    })
  }

  const body = await readValidatedBody(event, (raw) => bodySchema.parse(raw))
  const db = useDb()

  // Upsert utente per email
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1)

  let user = existing[0]
  if (!user) {
    const inserted = await db
      .insert(users)
      .values({
        email: body.email,
        displayName: body.displayName ?? body.email.split('@')[0]!,
      })
      .returning()
    user = inserted[0]!
  } else if (body.displayName && body.displayName !== user.displayName) {
    const updated = await db
      .update(users)
      .set({ displayName: body.displayName, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning()
    user = updated[0]!
  }

  // Sostituisci interamente i ruoli richiesti
  await db.delete(userRoles).where(eq(userRoles.userId, user.id))
  await db.insert(userRoles).values(body.roles.map((role) => ({ userId: user!.id, role })))

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: body.roles,
    },
    loggedInAt: new Date().toISOString(),
  })

  return { ok: true, user: { id: user.id, email: user.email, roles: body.roles } }
})
