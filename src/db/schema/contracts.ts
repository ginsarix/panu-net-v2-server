import { index, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { companies } from './company.js';

export const contracts = pgTable(
  'contracts',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 255 }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    companyId: integer('company_id').references(() => companies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
  },
  (t) => [
    index('contracts_title_idx').on(t.title),
    index('contracts_file_name_idx').on(t.fileName),
  ],
);
