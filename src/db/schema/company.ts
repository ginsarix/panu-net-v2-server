import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

export const companies = pgTable(
  'companies',
  {
    id: serial('id').primaryKey(),
    code: integer('code').notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    manager: varchar('manager', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    licenseDate: timestamp('license_date', { withTimezone: true }).notNull(),
    status: boolean('status').notNull(),
    webServiceSource: varchar('web_service_source', { length: 255 }).notNull(),
    webServiceUsername: varchar('web_service_username', { length: 255 }).notNull(),
    apiKey: varchar('api_key', { length: 255 }).notNull(),
    apiSecret: varchar('api_secret', { length: 255 }).notNull(),
    creationDate: timestamp('creation_date', { withTimezone: true }).defaultNow().notNull(),
    updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
  },
  (table) => ({
    codeIdx: uniqueIndex('companies_code_idx').on(table.code),
    statusIdx: index('companies_status_idx').on(table.status),
    nameIdx: index('companies_name_idx').on(table.name),
  }),
);
