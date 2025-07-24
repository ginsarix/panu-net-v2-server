import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { authorizedProcedure, protectedProcedure, router } from '../';
import {
  companyNotFoundMessage,
  couldntFetchCompaniesMessage,
  noCompanyAccessMessage,
  unauthorizedErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.ts';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.ts';
import { db } from '../../db';
import { companies } from '../../db/schema/company.ts';
import { usersToCompanies } from '../../db/schema/user-company.ts';
import { getCompanyById } from '../../services/companiesDb.ts';
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from '../../services/zod-validations/company.ts';

export const companyRouter = router({
  getCompanies: protectedProcedure
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
        const userId = Number(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';

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

        if (isAdmin) {
          const query = db
            .select()
            .from(companies)
            .where(whereClause ?? sql`TRUE`);

          const totalCountQuery = db
            .select({ total: sql<number>`count(*)` })
            .from(companies)
            .where(whereClause ?? sql`TRUE`);

          const [fetchedCompanies, totalCountResult] = await Promise.all([
            query.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
            totalCountQuery,
          ]);

          const total = totalCountResult[0]?.total ?? 0;

          return {
            companies: fetchedCompanies,
            total,
          };
        } else {
          const conditions = [eq(usersToCompanies.userId, userId)];
          if (whereClause) {
            conditions.push(whereClause);
          }

          const query = db
            .select()
            .from(companies)
            .innerJoin(usersToCompanies, eq(companies.id, usersToCompanies.companyId))
            .where(and(...conditions));

          const totalCountQuery = db
            .select({ total: sql<number>`count(*)` })
            .from(companies)
            .innerJoin(usersToCompanies, eq(companies.id, usersToCompanies.companyId))
            .where(and(...conditions));

          const [fetchedCompanies, totalCountResult] = await Promise.all([
            query.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
            totalCountQuery,
          ]);

          const total = totalCountResult[0]?.total ?? 0;

          return {
            companies: fetchedCompanies.map((c) => c.companies),
            total,
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
          message: deletedIds.includes(id) ? 'Şirket silindi' : 'Bu şirkete erişiminiz yok.',
        }));

        return {
          message:
            result.length !== ids.length
              ? 'Bazı şirketler silindi, bazıları bulunamadı.'
              : 'Silme operasyonu hatasız geçti',
          deletedRows: result.length,
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
        ctx.req.session.selectedCompanyId = String(input.id);

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

  getSelectedCompany: protectedProcedure.query(({ ctx }) => {
    try {
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
