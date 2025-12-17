import { check, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { definitions } from './definitions.js';
import { sql } from 'drizzle-orm';

export const currentDefinition = pgTable('current_definition', {
  id: integer('id').primaryKey().notNull(),
  definitionId: integer('definition_id')
    .references(() => definitions.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).$onUpdate(() => new Date()),
},
 (t) => [
 check("singleton", sql`${t.id} = 1`),
 ]);
