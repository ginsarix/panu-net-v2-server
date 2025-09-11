import { date, integer, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';

import { subscriptionCustomers } from './subscription-customer';

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
  userId: integer('user_id')
    .references(() => subscriptionCustomers.id, { onDelete: 'cascade' })
    .notNull(),
  creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
  updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
});
