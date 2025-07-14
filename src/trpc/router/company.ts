import { TRPCError } from '@trpc/server';
import { asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { publicProcedure, router } from '../';
import {
  companyNotFoundMessage,
  couldntFetchCompaniesMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.ts';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.ts';
import { CACHE_TTL } from '../../constants/redis.ts';
import { db } from '../../db';
import { companies } from '../../db/schema/company.ts';
import { getCompanyById } from '../../services/companiesDb.ts';
import { getRedis, ttlToHeader } from '../../services/redis.ts';
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from '../../services/zod-validations/company.ts';

export const companyRouter = router({
  getCompanies: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sort: z
          .enum(['creationDate', 'updatedOn', 'name', 'status', 'licenseDate', 'period', 'code'])
          .default('creationDate'),
        order: z.enum(['asc', 'desc']).default('desc'),
        search: z.string().default(''),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const { page, itemsPerPage, sort, order, search } = input;
        const skip = (page - 1) * itemsPerPage;
        const redis = getRedis();

        const cacheKey = `companies:${page}:${itemsPerPage}:${sort}:${order}:${search}`;
        const countKey = `companies:count:${search}`;

        const [cachedCompanies, cachedCount] = await Promise.all([
          redis.get(cacheKey),
          redis.get(countKey),
        ]);

        if (cachedCompanies && cachedCount) {
          ctx.res.header('X-Cache-Status', 'HIT');
          await ttlToHeader(cacheKey, ctx.res);
          return {
            companies: JSON.parse(cachedCompanies) as (typeof companies.$inferSelect)[],
            total: parseInt(cachedCount),
          };
        }

        const sortableColumns = {
          creationDate: companies.creationDate,
          updatedOn: companies.updatedOn,
          name: companies.name,
          status: companies.status,
          licenseDate: companies.licenseDate,
          period: companies.period,
          code: companies.code,
        };

        const sortColumn = sortableColumns[sort];
        const sortFn = order === 'asc' ? asc : desc;
        const whereClause = search ? ilike(companies.name, `%${search}%`) : undefined;

        const [fetchedCompanies, totalCount] = await Promise.all([
          db.query.companies.findMany({
            where: whereClause,
            orderBy: sortFn(sortColumn),
            offset: skip,
            limit: itemsPerPage,
          }),
          db
            .select({
              total: sql<number>`COUNT
                (*)`,
            })
            .from(companies)
            .where(whereClause ?? sql`TRUE`),
        ]);

        await Promise.all([
          redis.set(cacheKey, JSON.stringify(fetchedCompanies)),
          redis.expire(cacheKey, CACHE_TTL),
          redis.set(countKey, totalCount[0].total),
          redis.expire(countKey, CACHE_TTL),
        ]);

        ctx.res.header('X-Cache-Status', 'MISS');
        return {
          companies: fetchedCompanies,
          total: totalCount[0].total,
          cached: false,
        };
      } catch (error) {
        console.error('Failed to fetch companies: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchCompaniesMessage,
        });
      }
    }),

  getCompany: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const [message, code, result] = await getCompanyById(input.id);

        if (!result) {
          throw new TRPCError({
            code: code || 'INTERNAL_SERVER_ERROR',
            message: message || unexpectedErrorMessage,
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to fetch company: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchCompaniesMessage,
        });
      }
    }),

  createCompany: publicProcedure.input(CreateCompanySchema).mutation(async ({ input }) => {
    try {
      await db.insert(companies).values(input);
      return { message: 'Şirket başarıyla oluşturuldu.' };
    } catch (error) {
      console.error('Failed to create company: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Şirket oluşturulurken bir hata ile karşılaşıldı.',
      });
    }
  }),

  updateCompany: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateCompanySchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { id, data: updateDto } = input;

        const result = await db.update(companies).set(updateDto).where(eq(companies.id, id));

        if (result.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        return { message: 'Şirket güncellendi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to update company: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket düzenlenirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteCompany: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      try {
        const [message, code, result] = await getCompanyById(input.id);

        if (message) {
          throw new TRPCError({
            code: code || 'INTERNAL_SERVER_ERROR',
            message: message || unexpectedErrorMessage,
          });
        }

        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        const deleteResult = await db.delete(companies).where(eq(companies.id, result.id));

        if (deleteResult.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        return { message: 'Şirket silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to delete company: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteCompanies: publicProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input }) => {
      try {
        const { ids } = input;

        if (ids.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: "Şirket ID'leri gereklidir.",
          });
        }

        const existingCompanies = await db
          .select({ id: companies.id })
          .from(companies)
          .where(inArray(companies.id, ids));

        const existingIds = new Set(existingCompanies.map(c => c.id));

        const result = await db.delete(companies).where(inArray(companies.id, ids));

        if (result.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        const results = ids.map(id => ({
          id,
          status: existingIds.has(id),
          message: existingIds.has(id) ? 'Şirket silindi' : 'Şirket bulunamadı',
        }));

        return {
          message:
            result.rowCount !== ids.length
              ? 'Bazı şirketler silindi, bazıları bulunamadı.'
              : 'Silme operasyonu hatasız geçti',
          deletedRows: result.rowCount,
          results,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('An error occurred while deleting companies: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirketler silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  selectCompany: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ input, ctx }) => {
      try {
        if (ctx.req.session) {
          ctx.req.session.selectedCompanyId = String(input.id);
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Session bulunamadı.',
          });
        }

        return { message: 'Şirket başarıyla seçildi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error(`Failed to select company: ${input.id}`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket seçilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getSelectedCompany: publicProcedure.query(({ ctx }): { message: string; id: string } => {
    try {
      if (!ctx.req.session) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Session bulunamadı.',
        });
      }

      const id = ctx.req.session.selectedCompanyId;
      if (!id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Seçili şirket bulunamadı.',
        });
      }

      return {
        message: 'Seçili şirket başarıyla getirildi.',
        id,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('An error occurred while getting selected company: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Seçili şirket getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
