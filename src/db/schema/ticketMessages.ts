import { integer, pgTable, serial, index, timestamp, varchar } from 'drizzle-orm/pg-core';
import { tickets } from './tickets.js';
import { users } from './user.js';

export const ticketMessages = pgTable(
  'ticket_messages',
  {
    id: serial('id').primaryKey(),

    ticketId: integer('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade' }),

    authorUserId: integer('author_user_id').references(() => users.id, { onDelete: 'set null' }),

    message: varchar({ length: 5000 }).notNull(),

    creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ticket_messages_ticket_id_idx').on(t.ticketId),
    index('ticket_messages_creationDate_idx').on(t.creationDate.asc()),
  ],
);
