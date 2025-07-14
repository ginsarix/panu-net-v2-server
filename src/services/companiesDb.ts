import { eq } from 'drizzle-orm';

import { companyNotFoundMessage, idInvalidMessage } from '../constants/messages.ts';
import { db } from '../db';
import { companies } from '../db/schema/company.ts';
import { Result } from '../types/result.ts';
import { parseIntBase10 } from '../utils/parsing.ts';

type CompanyType = typeof companies.$inferSelect;

export const getCompanyById = async (id: string | number): Promise<Result<CompanyType>> => {
  const companyId = typeof id === 'string' ? parseIntBase10(id) : id;
  if (isNaN(companyId)) return [idInvalidMessage, 'BAD_REQUEST', null];

  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .then(rows => rows[0]);

  if (!company) {
    return [companyNotFoundMessage, 'NOT_FOUND', null];
  }

  return [null, null, company];
};
