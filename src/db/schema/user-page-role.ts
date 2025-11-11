import { index, integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';

import { pageRoles } from './page-role.js';
import { users } from './user.js';

export const usersToPageRoles = pgTable(
  'users_to_page_roles',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pageRoleId: integer('page_role_id')
      .notNull()
      .references(() => pageRoles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.pageRoleId] }),
    index('users_to_page_roles_user_id_idx').on(t.userId),
    index('users_to_page_roles_page_role_id_idx').on(t.pageRoleId),
  ],
);
