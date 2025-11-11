import { companies } from './company.js';
import { pageRoles } from './page-role.js';
import { subscriptionCustomers } from './subscription-customer.js';
import { subscriptions } from './subscription.js';
import { usersToCompanies } from './user-company.js';
import { usersToPageRoles } from './user-page-role.js';
import { users } from './user.js';

export const schema = {
  users,
  companies,
  usersToCompanies,
  subscriptions,
  subscriptionCustomers,
  pageRoles,
  usersToPageRoles,
};
