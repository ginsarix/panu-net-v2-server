import { pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

export const fileHashes = pgTable(
  'file_hashes',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).unique().notNull(),
    hash: varchar('hash', { length: 64 }).unique().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('file_hashes_name_idx').on(t.name),
    uniqueIndex('file_hashes_hash_idx').on(t.hash),
  ],
);
