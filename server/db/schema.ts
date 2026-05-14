/**
 * Schema Postgres — fonte di verità per DDL e tipi TS.
 *
 * Convenzioni:
 * - tutte le PK sono uuid generati lato DB
 * - timestamp sempre con timezone, default `now()`
 * - colonne in snake_case (vedi `casing` in drizzle.config)
 * - email e identifier microsoft sono unique parziali (case-insensitive applicato in app)
 */

import { boolean, date, integer, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
