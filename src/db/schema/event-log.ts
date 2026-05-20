import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './user.js';

export const eventLogs = pgTable(
  'event_logs',
  {
    id: serial('id').primaryKey(),

    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id'),
    action: text('action').notNull(),

    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),

    status: text('status').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('event_logs_created_at_idx').on(t.createdAt),
    index('event_logs_resource_type_idx').on(t.resourceType),
    index('event_logs_action_idx').on(t.action),
    index('event_logs_status_idx').on(t.status),
    index('event_logs_actor_id_idx').on(t.actorId),
  ],
);
