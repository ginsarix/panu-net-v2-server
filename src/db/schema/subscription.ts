import { date, pgEnum, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';

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
  creationDate: timestamp('creation_date', { withTimezone: true }).notNull().defaultNow(),
  updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
});
