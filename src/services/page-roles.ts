import { eq } from 'drizzle-orm';

import { PAGE_ROLE_DEFINITIONS } from '../constants/page-roles.js';
import { db } from '../db/index.js';
import { pageRoles } from '../db/schema/page-role.js';

export const getAllPageRoles = async () => {
  return await db.select().from(pageRoles).orderBy(pageRoles.name);
};

export const getPageRoleByKey = async (key: string) => {
  const [role] = await db.select().from(pageRoles).where(eq(pageRoles.key, key));
  return role;
};

export const getPageRoleById = async (id: number) => {
  const [role] = await db.select().from(pageRoles).where(eq(pageRoles.id, id));
  return role;
};

export const seedPageRoles = async () => {
  const existingRoles = await getAllPageRoles();
  const existingKeys = new Set(existingRoles.map((r) => r.key));

  const rolesToInsert = PAGE_ROLE_DEFINITIONS.filter((def) => !existingKeys.has(def.key));

  if (rolesToInsert.length === 0) {
    return { inserted: 0, message: 'All page roles already exist' };
  }

  const inserted = await db
    .insert(pageRoles)
    .values(
      rolesToInsert.map((def) => ({
        key: def.key,
        name: def.name,
        description: def.description,
        pagePath: def.pagePath,
      })),
    )
    .returning({ id: pageRoles.id });

  return { inserted: inserted.length, message: `Inserted ${inserted.length} page roles` };
};

