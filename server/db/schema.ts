/**
 * Schema Postgres — fonte di verità per DDL e tipi TS.
 *
 * Convenzioni:
 * - tutte le PK sono uuid generati lato DB
 * - timestamp sempre con timezone, default `now()`
 * - colonne in snake_case (vedi `casing` in drizzle.config)
 * - email e identifier microsoft sono unique parziali (case-insensitive applicato in app)
 */

import { boolean, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

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
    active: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    uniqueIndex('users_microsoft_oid_unique').on(t.microsoftOid),
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
