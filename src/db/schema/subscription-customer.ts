import { boolean, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';

export const subscriptionCustomers = pgTable('subscription_customers', {
  id: serial('id').primaryKey(),
  customerCode: varchar('customer_code', { length: 255 }),
  title: varchar('title', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 32 }),
  email: varchar('email', { length: 255 }).notNull(),
  remindExpiryWithEmail: boolean('remind_expiry_with_email').notNull().default(false),
  remindExpiryWithSms: boolean('remind_expiry_with_sms').notNull().default(false),
  address: varchar('address', { length: 255 }),
  status: boolean('status').notNull(),
  manager: varchar('manager', { length: 255 }),
  creationDate: timestamp('creation_date', { withTimezone: true }).defaultNow().notNull(),
  updatedOn: timestamp('updated_on', { withTimezone: true }).$onUpdate(() => new Date()),
});
