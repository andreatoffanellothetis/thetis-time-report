/**
 * Schema Postgres — fonte di verità per DDL e tipi TS.
 *
 * Convenzioni:
 * - tutte le PK sono uuid generati lato DB
 * - timestamp sempre con timezone, default `now()`
 * - colonne in snake_case (vedi `casing` in drizzle.config)
 * - email e identifier microsoft sono unique parziali (case-insensitive applicato in app)
 */

import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, pgEnum, pgTable, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum('user_role', ['employee', 'manager', 'admin'])
export type UserRole = (typeof userRoleEnum.enumValues)[number]

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull(),
    displayName: text().notNull(),
    /** Object ID Microsoft Entra ID — popolato dopo lo switch da stub a SSO reale. */
    microsoftOid: text(),
    /** ID del gestionale presenze esterno — per join con export Excel storici. */
    externalId: text(),
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_microsoft_oid_unique').on(t.microsoftOid),
    uniqueIndex('users_external_id_unique').on(t.externalId),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

/* -------------------------------------------------------------------------- */
/* User roles                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Tabella separata invece di colonna `role` su `users`: un dipendente può
 * essere employee + manager (capo di altri) contemporaneamente.
 * L'admin è singolo ruolo che implica accesso totale.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('user_roles_unique').on(t.userId, t.role)],
)

export type UserRoleRow = typeof userRoles.$inferSelect

/* -------------------------------------------------------------------------- */
/* Projects (commesse)                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Le commesse archiviate non vengono cancellate (preservano FK delle ore già
 * inserite). Non compaiono nei dropdown di inserimento ma restano leggibili
 * negli storici. Per archiviarle: set `archivedAt`.
 */
export const projects = pgTable(
  'projects',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    name: text().notNull(),
    client: text(),
    color: text().notNull().default('#64748b'),
    /** ID del gestionale esterno — per join con export Excel storici. */
    externalId: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('projects_code_unique').on(t.code),
    uniqueIndex('projects_external_id_unique').on(t.externalId),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert

/* -------------------------------------------------------------------------- */
/* Holidays (festività custom)                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Le festività nazionali italiane sono calcolate algoritmicamente
 * (vedi `useItalianHolidays.ts`). Questa tabella copre solo le eccezioni:
 * chiusure aziendali, ponti, santo patrono, festività locali.
 *
 * `recurring=true`: la data si ripete ogni anno (uso solo mese+giorno).
 * `recurring=false`: festività una-tantum (es. chiusura aziendale 2027-08-13).
 */
export const holidays = pgTable(
  'holidays',
  {
    id: uuid().primaryKey().defaultRandom(),
    date: date().notNull(),
    name: text().notNull(),
    recurring: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

export type Holiday = typeof holidays.$inferSelect
export type NewHoliday = typeof holidays.$inferInsert

/* -------------------------------------------------------------------------- */
/* Leave types (tipi orario non lavorativo)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Ferie, permessi (retribuiti/non), malattia, congedo parentale, 104...
 *
 * Flag chiave:
 * - `paid`: ore retribuite (impatta payroll, non gestito qui ma utile per export)
 * - `countsTowardsHours`: le ore di questo tipo "saturano" l'orario giornaliero
 *   atteso (es. permesso retribuito riempie le ore della giornata, ferie no
 *   perché la giornata è intera)
 * - `requiresApproval`: serve approvazione manager (workflow ferie/permessi)
 */
export const leaveTypes = pgTable(
  'leave_types',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    name: text().notNull(),
    paid: boolean().notNull().default(true),
    countsTowardsHours: boolean().notNull().default(false),
    requiresApproval: boolean().notNull().default(true),
    color: text().notNull().default('#94a3b8'),
    maxDaysPerYear: integer(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('leave_types_code_unique').on(t.code)],
)

export type LeaveType = typeof leaveTypes.$inferSelect
export type NewLeaveType = typeof leaveTypes.$inferInsert

/* -------------------------------------------------------------------------- */
/* Time entries (ore inserite dai dipendenti)                                  */
/* -------------------------------------------------------------------------- */

export const timeEntrySourceEnum = pgEnum('time_entry_source', [
  /** Inserita manualmente dal dipendente */
  'manual',
  /** Importata da export del gestionale presenze */
  'imported',
  /** Pre-fill da evento calendario Microsoft Outlook (poi confermata) */
  'outlook',
])
export type TimeEntrySource = (typeof timeEntrySourceEnum.enumValues)[number]

/**
 * Ogni riga è un segmento di tempo nella giornata di un dipendente.
 *
 * Due forme alternative (XOR enforced via CHECK):
 * - **Su commessa**: `projectId` set, `leaveTypeId` null
 * - **Assenza/permesso**: `leaveTypeId` set, `projectId` null
 *
 * `startTime`/`endTime` sono opzionali: una entry può essere "numerica"
 * (solo durata, senza orari precisi nella giornata) oppure "a blocco
 * orario" (con start/end). `durationMinutes` è sempre presente.
 *
 * `externalId` consente import idempotenti da fonti esterne (export
 * gestionale, calendario Outlook): la coppia (source, externalId) è unica
 * quando externalId è valorizzato.
 */
export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date().notNull(),
    startTime: time(),
    endTime: time(),
    durationMinutes: integer().notNull(),
    projectId: uuid().references(() => projects.id, { onDelete: 'restrict' }),
    leaveTypeId: uuid().references(() => leaveTypes.id, { onDelete: 'restrict' }),
    comment: text(),
    source: timeEntrySourceEnum().notNull().default('manual'),
    externalId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('time_entries_user_date_idx').on(t.userId, t.date),
    index('time_entries_project_idx').on(t.projectId),
    uniqueIndex('time_entries_external_unique')
      .on(t.source, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    check(
      'time_entries_kind_xor',
      sql`(${t.projectId} IS NOT NULL)::int + (${t.leaveTypeId} IS NOT NULL)::int = 1`,
    ),
    check(
      'time_entries_duration_positive',
      sql`${t.durationMinutes} > 0`,
    ),
    check(
      'time_entries_time_range',
      sql`(${t.startTime} IS NULL AND ${t.endTime} IS NULL) OR (${t.startTime} IS NOT NULL AND ${t.endTime} IS NOT NULL AND ${t.endTime} > ${t.startTime})`,
    ),
  ],
)

export type TimeEntry = typeof timeEntries.$inferSelect
export type NewTimeEntry = typeof timeEntries.$inferInsert
