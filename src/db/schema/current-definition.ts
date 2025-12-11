import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { definitions } from './definitions.js';

export const currentDefinition = pgTable('current_definition', {
  id: serial('id').primaryKey(),
  definitionId: integer('definition_id')
    .references(() => definitions.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
});
