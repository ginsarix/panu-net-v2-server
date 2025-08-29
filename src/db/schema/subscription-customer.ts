import { relations } from 'drizzle-orm';
import { boolean, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

import { subscriptions } from './subscription.js';

export const subscriptionCustomers = pgTable('subscription_customers', {
  id: serial('id').primaryKey(),
  customerCode: integer('customer_code'),
  title: varchar('title', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 255 }).notNull(),
  address: varchar('address', { length: 255 }),
  status: boolean('status').notNull(),
  manager: varchar('manager', { length: 255 }),
  creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionCustomersRelation = relations(subscriptionCustomers, ({ many }) => ({
  subscriptions: many(subscriptions),
}));
