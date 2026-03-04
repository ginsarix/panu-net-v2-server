import { relations } from 'drizzle-orm';

import { companies } from './company.js';
import { pageRoles } from './page-role.js';
import { subscriptionsToCustomers } from './subscription-customer-junction.js';
import { subscriptionCustomers } from './subscription-customer.js';
import { subscriptions } from './subscription.js';
import { usersToCompanies } from './user-company.js';
import { usersToPageRoles } from './user-page-role.js';
import { users } from './user.js';
import { contracts } from './contracts.js';
import { tickets } from './tickets.js';
import { ticketMessages } from './ticketMessages.js';

export const usersRelations = relations(users, ({ many }) => ({
  usersToCompanies: many(usersToCompanies),
  usersToPageRoles: many(usersToPageRoles),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  companies: one(companies, {
    fields: [contracts.companyId],
    references: [companies.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  usersToCompanies: many(usersToCompanies),
  contracts: many(contracts),
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
  subscriptionsToCustomers: many(subscriptionsToCustomers),
}));

export const subscriptionsRelations = relations(subscriptions, ({ many }) => ({
  subscriptionsToCustomers: many(subscriptionsToCustomers),
}));

export const subscriptionsToCustomersRelations = relations(subscriptionsToCustomers, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [subscriptionsToCustomers.subscriptionId],
    references: [subscriptions.id],
  }),
  customer: one(subscriptionCustomers, {
    fields: [subscriptionsToCustomers.customerId],
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

export const usersTicketsRelations = relations(users, ({ many }) => ({
  createdTickets: many(tickets),
}));

export const companiesTicketsRelations = relations(companies, ({ many }) => ({
  tickets: many(tickets),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  creator: one(users, {
    fields: [tickets.createdByUserId],
    references: [users.id],
  }),

  company: one(companies, {
    fields: [tickets.belongingCompanyId],
    references: [companies.id],
  }),

  messages: many(ticketMessages),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketMessages.ticketId],
    references: [tickets.id],
  }),

  author: one(users, {
    fields: [ticketMessages.authorUserId],
    references: [users.id],
  }),
}));
