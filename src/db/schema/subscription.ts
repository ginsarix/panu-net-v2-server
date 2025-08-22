import { relations } from 'drizzle-orm';
import { date, integer, pgEnum, pgTable, serial } from 'drizzle-orm/pg-core';

import { subscriptionCustomers } from './subscription-customer';

const subscriptionType = pgEnum('type', ['domain', 'ssl', 'hosting', 'mail']);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  type: subscriptionType(),
  userId: integer('user_id').notNull(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  customer: one(subscriptionCustomers, {
    fields: [subscriptions.userId],
    references: [subscriptionCustomers.id],
  }),
}));
