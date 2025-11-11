import { relations } from 'drizzle-orm';

import { companies } from './company.js';
import { pageRoles } from './page-role.js';
import { subscriptionCustomers } from './subscription-customer.js';
import { subscriptions } from './subscription.js';
import { usersToCompanies } from './user-company.js';
import { usersToPageRoles } from './user-page-role.js';
import { users } from './user.js';

export const usersRelations = relations(users, ({ many }) => ({
  usersToCompanies: many(usersToCompanies),
  usersToPageRoles: many(usersToPageRoles),
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

export const pageRolesRelations = relations(pageRoles, ({ many }) => ({
  usersToPageRoles: many(usersToPageRoles),
}));

export const usersToPageRolesRelations = relations(usersToPageRoles, ({ one }) => ({
  user: one(users, {
    fields: [usersToPageRoles.userId],
    references: [users.id],
  }),
  pageRole: one(pageRoles, {
    fields: [usersToPageRoles.pageRoleId],
    references: [pageRoles.id],
  }),
}));
