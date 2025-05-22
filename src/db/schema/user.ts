import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('user'),
  creationDate: timestamp('creationDate', { withTimezone: true }).notNull().defaultNow(),
  updatedOn: timestamp('updatedOn', { withTimezone: true }).notNull().defaultNow(),
});
