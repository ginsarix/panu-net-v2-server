import { eq } from 'drizzle-orm';

import { companyNotFoundMessage, idInvalidMessage } from '../constants/messages.js';
import { db } from '../db/index.js';
import { companies } from '../db/schema/company.js';
import type { Result } from '../types/result';
import { parseIntBase10 } from '../utils/parsing.js';

type CompanyType = typeof companies.$inferSelect;

export const getCompanyById = async (id: string | number): Promise<Result<CompanyType>> => {
  const companyId = typeof id === 'string' ? parseIntBase10(id) : id;
  if (isNaN(companyId)) return [idInvalidMessage, 'BAD_REQUEST', null];

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

  if (!company) {
    return [companyNotFoundMessage, 'NOT_FOUND', null];
  }

  return [null, null, company];
};
