import { relations } from 'drizzle-orm';
import { date, integer, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';

import { subscriptionCustomers } from './subscription-customer.js';

export const subscriptionTypeEnum = pgEnum('subscription_type', [
  'domain',
  'ssl',
  'hosting',
  'mail',
]);

export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  subscriptionType: subscriptionTypeEnum().notNull(),
  userId: integer('user_id').notNull(),
  creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  customer: one(subscriptionCustomers, {
    fields: [subscriptions.userId],
    references: [subscriptionCustomers.id],
  }),
}));
