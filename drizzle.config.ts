import { config as loadDotenv } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

loadDotenv({ path: '.env.local' })

const databaseUrl = process.env.NUXT_DATABASE_URL
if (!databaseUrl) {
  throw new Error('NUXT_DATABASE_URL non impostata (vedi .env.local)')
}

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: databaseUrl },
  casing: 'snake_case',
  strict: true,
  verbose: true,
})
