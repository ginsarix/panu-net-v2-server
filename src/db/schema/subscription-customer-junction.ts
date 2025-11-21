import { index, integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';

import { subscriptionCustomers } from './subscription-customer.js';
import { subscriptions } from './subscription.js';

export const subscriptionsToCustomers = pgTable(
  'subscriptions_to_customers',
  {
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    customerId: integer('customer_id')
      .notNull()
      .references(() => subscriptionCustomers.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.subscriptionId, t.customerId] }),
    index('subscriptions_to_customers_subscription_id_idx').on(t.subscriptionId),
    index('subscriptions_to_customers_customer_id_idx').on(t.customerId),
  ],
);
