/**
 * Client Drizzle condiviso lato server.
 *
 * Usa il driver `@neondatabase/serverless` (HTTP fetch): zero connessioni TCP
 * persistenti, perfetto per Vercel functions con cold start frequenti.
 *
 * Lazy init: la connection string viene letta solo al primo accesso, così
 * `drizzle.config.ts` (che importa lo schema indirettamente in alcuni casi)
 * non esplode in fase di tooling se la env non è caricata.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import * as schema from './schema'

let cachedDb: ReturnType<typeof drizzle<typeof schema>> | null = null

export function useDb() {
  if (cachedDb) return cachedDb

  const url = process.env.NUXT_DATABASE_URL
  if (!url) {
    throw new Error('NUXT_DATABASE_URL non impostata')
  }

  const sql = neon(url)
  cachedDb = drizzle(sql, { schema, casing: 'snake_case' })
  return cachedDb
}

export { schema }
