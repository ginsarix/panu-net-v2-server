import { index, integer, pgEnum, pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import { users } from './user.js';
import { companies } from './company.js';

export const ticketStateEnum = pgEnum('ticket_state_enum', [
  'open',
  'in_process',
  'completed',
  'reopened',
]);

export const priorityEnum = pgEnum('priority_enum', ['low', 'medium', 'high', 'urgent']);

export const tickets = pgTable(
  'tickets',
  {
    id: serial('id').primaryKey(),
    title: varchar({ length: 200 }).notNull(),
    description: varchar({ length: 5000 }),
    createdByUserId: integer('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    belongingCompanyId: integer('belonging_company_id').references(() => companies.id, {
      onDelete: 'set null',
    }),
    ticketState: ticketStateEnum().notNull().default('open'),
    priority: priorityEnum().notNull().default('medium'),
    creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
    updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
  },
  (t) => [
    index('tickets_company_idx').on(t.belongingCompanyId),
    index('tickets_user_idx').on(t.createdByUserId),
    index('tickets_state_idx').on(t.ticketState),
    index('tickets_priority_idx').on(t.priority),
    index('tickets_creation_date_idx').on(t.creationDate.desc()),
  ],
);
