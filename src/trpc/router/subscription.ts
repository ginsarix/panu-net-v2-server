import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, ilike } from 'drizzle-orm';
import z from 'zod';

import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination';
import { db } from '../../db/index';
import { subscriptions } from '../../db/schema/subscription';
import { subscriptionCustomers } from '../../db/schema/subscription-customer';
import { CreateSubscriptionSchema } from '../../services/zod-validations/subscription';
import { authorizedProcedure, protectedProcedure, router } from '../index';

export const subscriptionRouter = router({
  getSubscriptions: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sortBy: z
          .array(
            z
              .object({
                key: z.enum(['creationDate', 'startDate', 'endDate', 'subscriptionType']),
                order: z.enum(['asc', 'desc']),
              })
              .strict(),
          )
          .default([])
          .transform((val) => (!val.length ? [{ key: 'creationDate', order: 'desc' }] : val)),
        search: z.string().max(256).default(''),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const { page, itemsPerPage, sortBy, search } = input;

        const skip = (page - 1) * itemsPerPage;

        const sortableColumns = {
          creationDate: subscriptions.creationDate,
          startDate: subscriptions.startDate,
          endDate: subscriptions.endDate,
          subscriptionType: subscriptions.subscriptionType,
        } as const;

        const sortColumn = sortableColumns[sortBy[0].key as keyof typeof sortableColumns];
        const sortFn = sortBy[0].order === 'asc' ? asc : desc;
        const searchFilter = search ? ilike(subscriptionCustomers.title, `%${search}%`) : undefined;
        const currentUserFilter = eq(subscriptionCustomers.id, +ctx.user.id);

        const isAdmin = ctx.user.role === 'admin';

        const whereClause = !isAdmin
          ? searchFilter
            ? and(searchFilter, currentUserFilter)
            : currentUserFilter
          : searchFilter;

        const countSubquery = db
          .select({ subscriptions })
          .from(subscriptions)
          .innerJoin(subscriptionCustomers, eq(subscriptions.userId, subscriptionCustomers.id))
          .as('sub');

        const [allSubscriptionsRaw, totalCount] = await Promise.all([
          db
            .select({ subscriptions })
            .from(subscriptions)
            .innerJoin(subscriptionCustomers, eq(subscriptions.userId, subscriptionCustomers.id))
            .where(whereClause)
            .orderBy(sortFn(sortColumn))
            .offset(skip)
            .limit(itemsPerPage),
          db.$count(countSubquery, !isAdmin ? currentUserFilter : undefined),
        ]);

        const allSubscriptions = allSubscriptionsRaw.map((raw) => raw.subscriptions);

        return { subscriptions: allSubscriptions, total: totalCount };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to get subscriptions: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelikler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  createSubscription: authorizedProcedure
    .input(CreateSubscriptionSchema)
    .mutation(async ({ input }) => {
      try {
        const [result] = await db
          .insert(subscriptions)
          .values(input)
          .returning({ id: subscriptions.id, creationDate: subscriptions.creationDate });

        return {
          message: 'Abonelik başarıyla eklendi.',
          id: result.id,
          creationDate: result.creationDate,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Failed to create subscription', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelik oluşturulurken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
