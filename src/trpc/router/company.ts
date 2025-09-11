import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  companyNotFoundMessage,
  couldntFetchCompaniesMessage,
  noCompanyAccessMessage,
  unauthorizedErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination';
import { db } from '../../db/index';
import { companies } from '../../db/schema/company';
import { usersToCompanies } from '../../db/schema/user-company';
import { getCompanyById } from '../../services/companiesDb';
import { getPeriods, getWsCreditCount, login } from '../../services/web-service/sis';
import { CreateCompanySchema, UpdateCompanySchema } from '../../services/zod-validations/company';
import { authorizedProcedure, protectedProcedure, router } from '../index';

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

          const totalCountQuery = db.$count(
            db
              .select({ companies })
              .from(companies)
              .innerJoin(usersToCompanies, eq(companies.id, usersToCompanies.companyId)),
            !isAdmin ? currentUserFilter : undefined,
          );

          const [fetchedCompanies, totalCount] = await Promise.all([
            query.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
            totalCountQuery,
          ]);

          return {
            companies: fetchedCompanies.map((c) => c.companies),
            total: totalCount,
          };
        }
      } catch (error) {
        console.error('Failed to fetch companies: ', error);
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
            message: 'You do not have access to this company.',
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
        console.error('Failed to fetch company: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchCompaniesMessage,
        });
      }
    }),

  createCompany: authorizedProcedure.input(CreateCompanySchema).mutation(async ({ input }) => {
    try {
      await db.insert(companies).values(input);
      return { message: 'Şirket başarıyla oluşturuldu.' };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('Failed to create company: ', error);
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

        const result = await db.update(companies).set(updateDto).where(eq(companies.id, id));

        if (!result.rowCount) {
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

  deleteCompany: authorizedProcedure
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

        if (!deleteResult.rowCount) {
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

  deleteCompanies: authorizedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input }) => {
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
              ? 'Bazı firmalar silindi, bazıları bulunamadı.'
              : 'Silme operasyonu hatasız geçti',
          deletedRows: result.length,
          results,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('An error occurred while deleting companies: ', error);
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
        ctx.req.session.selectedCompanyId = input.id;

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

  getSelectedCompany: protectedProcedure.query(async ({ ctx }) => {
    try {
      const id = ctx.req.session.selectedCompanyId;

      const notFoundError = new TRPCError({
        code: 'NOT_FOUND',
        message: 'Seçili şirket bulunamadı.',
      });

      if (!id) throw notFoundError;

      const company = await db.select().from(companies).where(eq(companies.id, id));

      if (!company.length) throw notFoundError;

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

  setPeriod: protectedProcedure
    .input(z.object({ periodCode: z.number().int().positive() }))
    .query(({ input, ctx }) => {
      try {
        ctx.req.session.selectedPeriodCode = input.periodCode;

        return { message: 'Dönem başarıyla seçildi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('An error occurred while getting setting period: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Dönem seçilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getSelectedPeriod: protectedProcedure.query(({ ctx }) => {
    try {
      return { code: ctx.req.session.selectedPeriodCode };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('An error occurred while getting company periods: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Seçili Dönem getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),

  getPeriods: protectedProcedure
    .input(z.object({ companyCode: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        await login(ctx.req);
        const response = await getPeriods(ctx.req, input.companyCode);

        return response.result.m_donemler;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('An error occurred while getting company periods: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Dönemler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getCreditCount: protectedProcedure.query(async ({ ctx }) => {
    try {
      await login(ctx.req);
      const response = await getWsCreditCount(ctx.req);

      return response.result.kontorsayisi;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('An error occurred while getting credit count: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Kontör sorgulanırken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
