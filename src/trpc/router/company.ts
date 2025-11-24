import { TRPCError } from '@trpc/server';
import { tracked } from '@trpc/server';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { on } from 'node:events';
import { z } from 'zod';

import {
  companyNotFoundMessage,
  couldntFetchCompaniesMessage,
  noCompanyAccessMessage,
  unauthorizedErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { companies } from '../../db/schema/company.js';
import { usersToCompanies } from '../../db/schema/user-company.js';
import { checkCompanyLicense, getCompanyById } from '../../services/companiesDb.js';
import { creditCountEmitter } from '../../services/credit-count-emitter.js';
import { getPeriods, getWsCreditCount, login } from '../../services/web-service/sis.js';
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from '../../services/zod-validations/company.js';
import { authorizedProcedure, protectedProcedure, router } from '../index.js';

export const companyRouter = router({
  getCompanies: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sortBy: z
          .array(
            z
              .object({
                key: z.enum(['creationDate', 'updatedOn', 'name', 'status', 'licenseDate', 'code']),
                order: z.enum(['asc', 'desc']),
              })
              .strict(),
          )
          .default([])
          .transform((val) => (!val.length ? [{ key: 'creationDate', order: 'desc' }] : val)),
        search: z.string().max(256).default(''),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const { page, itemsPerPage, sortBy, search } = input;
        const skip = (page - 1) * itemsPerPage;
        const userId = Number(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';

        const sortableColumns = {
          creationDate: companies.creationDate,
          updatedOn: companies.updatedOn,
          name: companies.name,
          status: companies.status,
          licenseDate: companies.licenseDate,
          code: companies.code,
        } as const;

        const sortColumn = sortableColumns[sortBy[0].key as keyof typeof sortableColumns];
        const sortFn = sortBy[0].order === 'asc' ? asc : desc;
        const searchFilter = search ? ilike(companies.name, `%${search}%`) : undefined;
        const currentUserFilter = eq(usersToCompanies.userId, userId);

        const whereClause = !isAdmin
          ? searchFilter
            ? and(searchFilter, currentUserFilter)
            : currentUserFilter
          : searchFilter;

        if (isAdmin) {
          const query = db
            .select()
            .from(companies)
            .where(whereClause ?? sql`TRUE`);

          const [fetchedCompanies, totalCount] = await Promise.all([
            query.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
            db.$count(companies),
          ]);

          return {
            companies: fetchedCompanies,
            total: totalCount,
          };
        } else {
          const query = db
            .select({ companies })
            .from(companies)
            .innerJoin(usersToCompanies, eq(companies.id, usersToCompanies.companyId))
            .where(whereClause);

          const totalCountQuery = db
            .select({ count: sql<number>`count(*)` })
            .from(companies)
            .innerJoin(usersToCompanies, eq(companies.id, usersToCompanies.companyId))
            .where(whereClause);

          const [fetchedCompanies, totalCount] = await Promise.all([
            query.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
            totalCountQuery,
          ]);

          return {
            companies: fetchedCompanies.map((c) => c.companies),
            total: totalCount[0]?.count || 0,
          };
        }
      } catch (error) {
        ctx.req.log.error(error, 'Failed to fetch companies');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchCompaniesMessage,
        });
      }
    }),

  getCompany: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      try {
        const userId = Number(ctx.user.id);
        const userCompany = await db
          .select()
          .from(usersToCompanies)
          .where(
            and(eq(usersToCompanies.userId, userId), eq(usersToCompanies.companyId, input.id)),
          );
        if (!userCompany.length)
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Bu şirkete erişiminiz yoktur.',
          });
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
        ctx.req.log.error(error, 'Failed to fetch company');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchCompaniesMessage,
        });
      }
    }),

  createCompany: authorizedProcedure.input(CreateCompanySchema).mutation(async ({ input, ctx }) => {
    try {
      const [createdCompany] = await db
        .insert(companies)
        .values(input)
        .returning({ id: companies.id, creationDate: companies.creationDate });
      return {
        id: createdCompany.id,
        creationDate: createdCompany.creationDate,
        message: 'Şirket başarıyla oluşturuldu.',
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to create company');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Şirket oluşturulurken bir hata ile karşılaşıldı.',
      });
    }
  }),

  updateCompany: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateCompanySchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { id, data: updateDto } = input;
        const isAdmin = ctx.user.role === 'admin';
        const userId = Number(ctx.user.id);

        if (!isAdmin) {
          const userCompany = await db
            .select()
            .from(usersToCompanies)
            .where(and(eq(usersToCompanies.userId, userId), eq(usersToCompanies.companyId, id)));

          if (!userCompany.length) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: unauthorizedErrorMessage,
            });
          }
        }

        const updatedCompanies = await db
          .update(companies)
          .set(updateDto)
          .where(eq(companies.id, id))
          .returning({ updatedOn: companies.updatedOn });

        if (!updatedCompanies.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        return { updatedOn: updatedCompanies[0].updatedOn, message: 'Şirket güncellendi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to update company');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket düzenlenirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteCompany: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
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

        if (!deleteResult.rowCount) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        return { message: 'Şirket silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to delete company');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteCompanies: authorizedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { ids } = input;

        if (!ids.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: "Şirket ID'leri gereklidir.",
          });
        }

        const result = await db
          .delete(companies)
          .where(inArray(companies.id, ids))
          .returning({ id: companies.id });

        if (!result.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: companyNotFoundMessage,
          });
        }

        const deletedIds = result.map((r) => r.id);
        const results = ids.map((id) => ({
          id,
          status: deletedIds.includes(id),
          message: deletedIds.includes(id) ? 'Firma silindi' : 'Bu firmaya erişiminiz yok.',
        }));

        return {
          message:
            result.length !== ids.length
              ? 'Bazı firmalar silindi, bazıları silinemedi.'
              : 'Silme operasyonu hatasız geçti',
          deletedRows: result.length,
          results,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'An error occurred while deleting companies');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Firmalar silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  selectCompany: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user.role === 'user') {
          const userId = Number(ctx.user.id);

          const [message, code] = await checkCompanyLicense(input.id);
          if (code) {
            throw new TRPCError({
              code: code || 'INTERNAL_SERVER_ERROR',
              message: message! || unexpectedErrorMessage,
            });
          }

          const userCompany = await db
            .select()
            .from(usersToCompanies)
            .where(
              and(eq(usersToCompanies.userId, userId), eq(usersToCompanies.companyId, input.id)),
            );
          if (!userCompany.length) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: noCompanyAccessMessage,
            });
          }
        }

        ctx.req.session.set('selectedCompanyId', input.id);

        // the selected period code is set to 0 (which the DIA web service interprets as the default)
        // to prevent the selection of potential non-existenting periods. e.g, the user selects the 8th period in a company,
        // but when they switch to a different company that previously selected period doesn't exist in the company they just selected,
        // so the safe approach is to set it to 0 and let it fallback to default.
        ctx.req.session.set('selectedPeriodCode', 0);
        await ctx.req.session.save();

        return { message: 'Şirket başarıyla seçildi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, `Failed to select company: ${input.id}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Şirket seçilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getSelectedCompany: protectedProcedure.query(async ({ ctx }) => {
    try {
      const id = ctx.req.session.get('selectedCompanyId');

      const notFoundError = new TRPCError({
        code: 'NOT_FOUND',
        message: 'Şirket bulunamadı.',
      });

      if (!id) return { message: 'Şirket bulunamadı.', id: null };

      const company = await db.select().from(companies).where(eq(companies.id, id));

      if (!company.length) throw notFoundError;

      return {
        message: 'Seçili şirket başarıyla getirildi.',
        id,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'An error occurred while getting selected company');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Seçili şirket getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),

  setPeriod: protectedProcedure
    .input(z.object({ periodCode: z.number().int().nonnegative() }))
    .mutation(async ({ input, ctx }) => {
      try {
        ctx.req.session.set('selectedPeriodCode', input.periodCode);

        await ctx.req.session.save();

        return { message: 'Dönem başarıyla seçildi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'An error occurred while setting period');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Dönem seçilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getSelectedPeriod: protectedProcedure.query(({ ctx }): { code: number | undefined } => {
    try {
      const code = ctx.req.session.get('selectedPeriodCode');
      return { code };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'An error occurred while getting company periods');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Seçili Dönem getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),

  getPeriods: protectedProcedure
    .input(z.object({ companyCode: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      try {
        await login(ctx.req);
        const response = await getPeriods(ctx.req, input.companyCode);

        return response.result.m_donemler;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'An error occurred while getting company periods');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Dönemler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getCreditCount: protectedProcedure.subscription(async function* (opts) {
    const selectedCompanyId = opts.ctx.req.session.get('selectedCompanyId');
    if (!selectedCompanyId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Seçili şirket bulunmamaktadır.',
      });
    }

    // Fetch initial credit count
    try {
      await login(opts.ctx.req);
      const response = await getWsCreditCount(opts.ctx.req);
      // Yield initial credit count with tracking for reconnection support
      yield tracked(`creditCount:${selectedCompanyId}`, response.result.kontorsayisi);
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      opts.ctx.req.log.error(error, 'An error occurred while getting credit count');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Kontör sorgulanırken bir hata ile karşılaşıldı.',
      });
    }

    // Listen for credit count change events
    try {
      for await (const [creditCount] of on(creditCountEmitter, `creditCount:${selectedCompanyId}`, {
        signal: opts.signal,
      })) {
        yield tracked(`creditCount:${selectedCompanyId}`, creditCount as number);
      }
    } catch (error) {
      // Handle cancellation or errors
      if (error instanceof Error && error.name === 'AbortError') {
        // Subscription was cancelled, this is normal
        return;
      }
      throw error;
    }
  }),
});
