import { companies } from './company.js';
import { pageRoles } from './page-role.js';
import { subscriptionsToCustomers } from './subscription-customer-junction.js';
import { subscriptionCustomers } from './subscription-customer.js';
import { subscriptions } from './subscription.js';
import { usersToCompanies } from './user-company.js';
import { usersToPageRoles } from './user-page-role.js';
import { users } from './user.js';
import { fileHashes } from './fileHashes.js';
import { contracts } from './contracts.js';

export const schema = {
  users,
  companies,
  usersToCompanies,
  subscriptions,
  subscriptionCustomers,
  subscriptionsToCustomers,
  pageRoles,
  usersToPageRoles,
  fileHashes,
  contracts,
};
