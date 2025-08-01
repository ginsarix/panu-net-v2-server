import { boolean, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: serial('id').primaryKey(),
  code: integer('code').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  manager: varchar('manager', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  licenseDate: timestamp('license_date', { withTimezone: true }).notNull(),
  status: boolean('status').notNull(),
  webServiceSource: varchar('web_service_source', { length: 255 }).notNull(),
  webServiceUsername: varchar('web_service_username', { length: 255 }).notNull(),
  serverName: varchar('server_name', { length: 255 }).notNull(),
  apiKey: varchar('api_key', { length: 255 }).notNull(),
  apiSecret: varchar('api_secret', { length: 255 }).notNull(),
  creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
  updatedOn: timestamp('updated_on', { withTimezone: true }).notNull().defaultNow(),
});
