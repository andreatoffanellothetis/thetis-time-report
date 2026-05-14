import { asc, eq } from 'drizzle-orm'

import { useDb } from '~~/server/db'
import { users } from '~~/server/db/schema'

/** Lista utenti, usata da filtri admin (commessa, dipendente, ecc). */
export default defineEventHandler(async () => {
  return useDb()
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      active: users.active,
    })
    .from(users)
    .where(eq(users.active, true))
    .orderBy(asc(users.displayName))
})
