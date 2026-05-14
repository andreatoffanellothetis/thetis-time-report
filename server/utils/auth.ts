/**
 * Helpers auth lato server.
 *
 * Tutto il codice protetto chiama `requireAuth(event)` o `requireRole(event, ...)`.
 * Il meccanismo sottostante è una sealed-cookie session (`nuxt-auth-utils`).
 * Quando arriverà l'OAuth Microsoft, basterà sostituire il modo in cui la
 * sessione viene creata (endpoint dev-login → callback OAuth) — niente cambia
 * per i consumer.
 */

import type { H3Event } from 'h3'
import { createError } from 'h3'

import type { UserRole } from '../db/schema'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  roles: UserRole[]
}

declare module '#auth-utils' {
  interface User extends SessionUser {}
  interface UserSession {
    loggedInAt: string
  }
}

export async function requireAuth(event: H3Event): Promise<SessionUser> {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non autenticato' })
  }
  return session.user as SessionUser
}

export async function requireRole(
  event: H3Event,
  ...allowed: UserRole[]
): Promise<SessionUser> {
  const user = await requireAuth(event)
  if (!user.roles.some((role) => allowed.includes(role))) {
    throw createError({
      statusCode: 403,
      statusMessage: `Ruolo richiesto: ${allowed.join(' | ')}`,
    })
  }
  return user
}

export function isDevLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.NUXT_ALLOW_DEV_LOGIN === 'true'
  )
}
