import { index, pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    phone: varchar('phone', { length: 32 }),
    password: varchar('password', { length: 255 }).notNull(),
    role: varchar('role', { length: 32 }).notNull().default('user'),
    creationDate: timestamp('creation_date', { withTimezone: true }).defaultNow().notNull(),
    updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    roleIdx: index('users_role_idx').on(table.role),
    lastLoginIdx: index('users_last_login_idx').on(table.lastLoginAt),
  }),
);
