import { companies } from './company.ts';
import { subscriptionCustomers } from './subscription-customer.ts';
import { subscriptions } from './subscription.ts';
import { usersToCompanies } from './user-company.ts';
import { users } from './user.ts';

export const schema = { users, companies, usersToCompanies, subscriptions, subscriptionCustomers };
