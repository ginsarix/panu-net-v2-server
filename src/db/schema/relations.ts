import { relations } from 'drizzle-orm';

import { companies } from './company';
import { subscriptions } from './subscription';
import { subscriptionCustomers } from './subscription-customer';
import { users } from './user';
import { usersToCompanies } from './user-company';

export const usersRelations = relations(users, ({ many }) => ({
  usersToCompanies: many(usersToCompanies),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  usersToCompanies: many(usersToCompanies),
}));

export const usersToCompaniesRelations = relations(usersToCompanies, ({ one }) => ({
  user: one(users, {
    fields: [usersToCompanies.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [usersToCompanies.companyId],
    references: [companies.id],
  }),
}));

export const subscriptionCustomersRelation = relations(subscriptionCustomers, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  customer: one(subscriptionCustomers, {
    fields: [subscriptions.userId],
    references: [subscriptionCustomers.id],
  }),
}));
