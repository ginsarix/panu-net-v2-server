import { pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('user'),
  creationDate: timestamp('creation_date', { withTimezone: true }).defaultNow().notNull(),
  updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
});
