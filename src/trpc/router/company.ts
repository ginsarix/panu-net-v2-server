import { TRPCError } from '@trpc/server';
import { tracked } from '@trpc/server';
import { and, asc, desc, eq, getTableColumns, ilike, inArray, sql } from 'drizzle-orm';
import { on } from 'node:events';
import { z } from 'zod';


import {
  companyNotFoundMessage,
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
import { logEvent } from '../../utils/event-log.js';
import { users } from '../../db/schema/user.js';

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
    }),

  getCompany: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const userId = Number(ctx.user.id);
      const userCompany = await db
        .select()
        .from(usersToCompanies)
        .where(and(eq(usersToCompanies.userId, userId), eq(usersToCompanies.companyId, input.id)));
      if (!userCompany.length)
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Bu firmaya erişiminiz yoktur.',
        });
      const [message, code, result] = await getCompanyById(input.id);

      if (!result) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message || unexpectedErrorMessage,
        });
      }

      return result;
    }),

  createCompany: authorizedProcedure.input(CreateCompanySchema).mutation(async ({ input, ctx }) => {
    const [createdCompany] = await db
      .insert(companies)
      .values(input)
      .returning({ id: companies.id, creationDate: companies.creationDate });
    logEvent({
      resourceType: 'firma',
      resourceId: String(createdCompany.id),
      action: 'oluşturuldu',
      actorId: Number(ctx.user.id),
      status: 'başarılı',
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.headers['user-agent'] ?? null,
    });
    return {
      id: createdCompany.id,
      creationDate: createdCompany.creationDate,
      message: 'Firma başarıyla oluşturuldu.',
    };
  }),

  updateCompany: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateCompanySchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
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

      logEvent({
        resourceType: 'firma',
        resourceId: String(id),
        action: 'güncellendi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { updatedOn: updatedCompanies[0].updatedOn, message: 'Firma güncellendi.' };
    }),

  deleteCompany: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
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

      logEvent({
        resourceType: 'firma',
        resourceId: String(result.id),
        action: 'silindi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Firma silindi.' };
    }),

  deleteCompanies: authorizedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input, ctx }) => {
      const { ids } = input;

      if (!ids.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: "Firma ID'leri gereklidir.",
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

      logEvent(
        result.map((r) => ({
          resourceType: 'firma',
          resourceId: String(r.id),
          action: 'silindi',
          actorId: Number(ctx.user.id),
          status: 'başarılı' as const,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        })),
      );
      return {
        message:
          result.length !== ids.length
            ? 'Bazı firmalar silindi, bazıları silinemedi.'
            : 'Silme operasyonu hatasız geçti',
        deletedRows: result.length,
        results,
      };
    }),

  selectCompany: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
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
      const oldSelectedCompanyId = ctx.req.session.get('selectedCompanyId');

      ctx.req.session.set('selectedCompanyId', input.id);

      // the selected period code is set to 0 (which the DIA web service interprets as the default)
      // to prevent the selection of potential non-existenting periods. e.g, the user selects the 8th period in a company,
      // but when they switch to a different company that previously selected period doesn't exist in the company they just selected,
      // so the safe approach is to set it to 0 and let it fallback to default.
      if (oldSelectedCompanyId && oldSelectedCompanyId !== input.id)
        ctx.req.session.set('selectedPeriodCode', 0);

      await ctx.req.session.save();

      logEvent({
        resourceType: 'firma',
        resourceId: String(input.id),
        action: 'seçildi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Firma başarıyla seçildi.' };
    }),

  getSelectedCompany: protectedProcedure.query(async ({ ctx }) => {
    const id = ctx.req.session.get('selectedCompanyId');

    const notFoundError = new TRPCError({
      code: 'NOT_FOUND',
      message: 'Firma bulunamadı.',
    });

    if (!id) return { message: 'Firma bulunamadı.', id: null };

    const company = await db.select().from(companies).where(eq(companies.id, id));

    if (!company.length) throw notFoundError;

    return {
      message: 'Seçili firma başarıyla getirildi.',
      id,
    };
  }),

  setPeriod: protectedProcedure
    .input(z.object({ periodCode: z.number().int().nonnegative() }))
    .mutation(async ({ input, ctx }) => {
      ctx.req.session.set('selectedPeriodCode', input.periodCode);

      await ctx.req.session.save();

      return { message: 'Dönem başarıyla seçildi.' };
    }),

  getSelectedPeriod: protectedProcedure.query(({ ctx }): { code: number | undefined } => {
    const code = ctx.req.session.get('selectedPeriodCode');
    return { code };
  }),

  getPeriods: protectedProcedure.query(async ({ ctx }) => {
    const selectedCompanyId = ctx.req.session.get('selectedCompanyId');
    if (!selectedCompanyId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seçili firma bulunamadı.' });
    }

    const [message, code, result] = await getCompanyById(selectedCompanyId);
    if (!result) {
      throw new TRPCError({
        code: code || 'INTERNAL_SERVER_ERROR',
        message: message || unexpectedErrorMessage,
      });
    }

    await login(ctx.req);
    const response = await getPeriods(ctx.req, result.webServiceSource, result.code);
    return response.result.m_donemler;
  }),

  getCreditCount: protectedProcedure.subscription(async function* (opts) {
    const selectedCompanyId = opts.ctx.req.session.get('selectedCompanyId');
    if (!selectedCompanyId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Seçili firma bulunmamaktadır.',
      });
    }

    // Fetch initial credit count
    await login(opts.ctx.req);
    const response = await getWsCreditCount(opts.ctx.req);
    yield tracked(`creditCount:${selectedCompanyId}`, response.result.kontorsayisi);

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

  getUsersInSelectedCompany: protectedProcedure.query(async ({ ctx }) => {
    const selectedCompanyId = ctx.req.session.get('selectedCompanyId');

    if (!selectedCompanyId)
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Seçili firma bulunamadı.',
      });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping
    const { password, ...strippedUserColumns } = getTableColumns(users);

    const usersInSelectedFirm = await db
      .select({ ...strippedUserColumns })
      .from(usersToCompanies)
      .where(eq(usersToCompanies.companyId, selectedCompanyId))
      .innerJoin(users, eq(users.id, usersToCompanies.userId));

    return {
      message: 'Seçili firmadaki kullanıcılar başarıyla getirildi.',
      users: usersInSelectedFirm,
    };
  }),

});
