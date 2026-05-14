/**
 * Seed del DB Neon a partire dai due Excel del gestionale.
 * Idempotente: upsert su `users.email`, `projects.code`, `leave_types.code`.
 *
 * Uso:
 *   pnpm tsx scripts/seed-from-excel.ts <daily.xlsx> <project-logs.xlsx>
 */

import { config as loadDotenv } from 'dotenv'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import ExcelJS from 'exceljs'

loadDotenv({ path: '.env.local' })

const url = process.env.NUXT_DATABASE_URL
if (!url) throw new Error('NUXT_DATABASE_URL mancante (.env.local)')

const { users, userRoles, projects, leaveTypes } = await import('../server/db/schema')
const db = drizzle(neon(url), { schema: { users, userRoles, projects, leaveTypes }, casing: 'snake_case' })

/* ----------------------------- Helpers ----------------------------- */

const PALETTE = [
  '#0048ff', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4',
  '#84cc16', '#f43f5e', '#a855f7', '#14b8a6', '#eab308', '#3b82f6',
]
function colorFor(seed: string): string {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0
  return PALETTE[Math.abs(h) % PALETTE.length]!
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function emailFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = slug(parts[0] ?? '')
  const last = slug(parts.slice(1).join(''))
  return `${first}.${last}@thetisit.com`
}

function parseProjectLabel(label: string): { code: string, name: string, client: string | null } {
  const m = label.match(/^(\S+)\s*-\s*(.+)$/)
  if (!m) return { code: label, name: label, client: null }
  const code = m[1]!
  let name = m[2]!.trim()
  let client: string | null = null
  const cm = name.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (cm) {
    name = cm[1]!.trim()
    client = cm[2]!.trim()
  }
  return { code, name, client }
}

async function loadSheet(file: string) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]!
  const headers = (ws.getRow(1).values as unknown[]).map((v) => (typeof v === 'string' ? v : null))
  return { ws, headers }
}

function colIdx(headers: (string | null)[], name: string): number {
  return headers.indexOf(name)
}

/* ----------------------------- Read files ----------------------------- */

const [dailyFile, logsFile] = process.argv.slice(2)
if (!dailyFile || !logsFile) {
  throw new Error('Specifica i due file: seed-from-excel.ts <daily.xlsx> <project-logs.xlsx>')
}

const daily = await loadSheet(dailyFile)
const logs = await loadSheet(logsFile)

/* ----------------------------- Users ----------------------------- */

const ADMIN_EXTERNAL_ID = '17355587' // Andrea Toffanello

const empIdCol = colIdx(daily.headers, 'employee_id')
const empNameCol = colIdx(daily.headers, 'employee_name')
const empMap = new Map<string, string>()
for (let i = 3; i <= daily.ws.rowCount; i++) {
  const id = daily.ws.getRow(i).getCell(empIdCol).value
  const name = daily.ws.getRow(i).getCell(empNameCol).value
  if (id && name) empMap.set(String(id), String(name))
}

console.log(`\n→ Seeding ${empMap.size} users...`)
for (const [externalId, displayName] of empMap) {
  const email = emailFromName(displayName)

  const [user] = await db
    .insert(users)
    .values({ email, displayName, externalId, active: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { displayName, externalId, updatedAt: new Date() },
    })
    .returning()

  if (!user) continue

  // Ruoli: tutti `employee`, Andrea anche `admin`
  const wantedRoles: ('employee' | 'manager' | 'admin')[] =
    externalId === ADMIN_EXTERNAL_ID ? ['employee', 'admin'] : ['employee']

  await db.delete(userRoles).where(eq(userRoles.userId, user.id))
  await db.insert(userRoles).values(wantedRoles.map((role) => ({ userId: user.id, role })))

  console.log(`  ${email.padEnd(40)} ${wantedRoles.join('+')}`)
}

/* ----------------------------- Projects ----------------------------- */

const pidCol = colIdx(logs.headers, 'ID progetto')
const pnameCol = colIdx(logs.headers, 'Progetto')
const projMap = new Map<string, string>()
for (let i = 3; i <= logs.ws.rowCount; i++) {
  const id = logs.ws.getRow(i).getCell(pidCol).value
  const name = logs.ws.getRow(i).getCell(pnameCol).value
  if (id && name) projMap.set(String(id), String(name))
}

console.log(`\n→ Seeding ${projMap.size} projects...`)
for (const [externalId, rawLabel] of projMap) {
  const parsed = parseProjectLabel(rawLabel)
  const color = colorFor(parsed.code)

  await db
    .insert(projects)
    .values({
      code: parsed.code,
      name: parsed.name,
      client: parsed.client,
      color,
      externalId,
    })
    .onConflictDoUpdate({
      target: projects.code,
      set: {
        name: parsed.name,
        client: parsed.client,
        externalId,
        updatedAt: new Date(),
      },
    })

  console.log(`  ${parsed.code.padEnd(8)} ${parsed.name}${parsed.client ? ` (${parsed.client})` : ''}`)
}

/* ----------------------------- Leave types ----------------------------- */

const leaveTypesData = [
  { code: 'FERIE', name: 'Ferie', paid: true, countsTowardsHours: false, requiresApproval: true, color: '#10b981', maxDaysPerYear: 26 },
  { code: 'PERMESSO_R', name: 'Permesso retribuito', paid: true, countsTowardsHours: true, requiresApproval: true, color: '#3b82f6', maxDaysPerYear: null },
  { code: 'PERMESSO_REC', name: 'Permesso recuperabile', paid: false, countsTowardsHours: true, requiresApproval: true, color: '#8b5cf6', maxDaysPerYear: null },
  { code: 'PERMESSO_NR', name: 'Permesso non retribuito', paid: false, countsTowardsHours: false, requiresApproval: true, color: '#6b7280', maxDaysPerYear: null },
  { code: 'MALATTIA', name: 'Malattia', paid: true, countsTowardsHours: false, requiresApproval: false, color: '#f43f5e', maxDaysPerYear: null },
  { code: 'DONAZIONE', name: 'Donazione del sangue', paid: true, countsTowardsHours: false, requiresApproval: true, color: '#ec4899', maxDaysPerYear: 4 },
]

console.log(`\n→ Seeding ${leaveTypesData.length} leave types...`)
for (const lt of leaveTypesData) {
  await db
    .insert(leaveTypes)
    .values(lt)
    .onConflictDoUpdate({
      target: leaveTypes.code,
      set: {
        name: lt.name,
        paid: lt.paid,
        countsTowardsHours: lt.countsTowardsHours,
        requiresApproval: lt.requiresApproval,
        color: lt.color,
        maxDaysPerYear: lt.maxDaysPerYear,
        updatedAt: new Date(),
      },
    })
  console.log(`  ${lt.code.padEnd(15)} ${lt.name}`)
}

console.log('\n✔ Seed completato.')
console.log(`  ${empMap.size} users, ${projMap.size} projects, ${leaveTypesData.length} leave_types`)

// Sanity check: ruoli admin
const adminCount = await db.execute(
  sql`SELECT COUNT(*)::int AS n FROM user_roles WHERE role = 'admin'`,
)
console.log(`  admin role count: ${(adminCount as Array<{ n: number }>)[0]?.n}`)
