import { index, integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';

import { companies } from './company.js';
import { users } from './user.js';

export const usersToCompanies = pgTable(
  'users_to_companies',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    companyId: integer('company_id')
      .notNull()
      .references(() => companies.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.companyId] }),
    index('users_to_companies_user_id_idx').on(t.userId),
    index('users_to_companies_company_id_idx').on(t.companyId),
  ],
);
