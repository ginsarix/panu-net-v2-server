import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { subscriptionsToCustomers } from '../../db/schema/subscription-customer-junction.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import { subscriptions } from '../../db/schema/subscription.js';
import {
  CreateSubscriptionSchema,
  UpdateSubscriptionSchema,
} from '../../services/zod-validations/subscription.js';
import { authorizedProcedure, pageRoleProtectedProcedure, router } from '../index.js';

export const subscriptionRouter = router({
  getSubscriptions: pageRoleProtectedProcedure('SUBSCRIPTION_VIEW')
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
        const isAdmin = ctx.user.role === 'admin';

        // For non-admin users, we need to filter by customer relationships
        // For admin users with search, we need to filter by customer title
        let customerWhereClause: ReturnType<typeof and> | ReturnType<typeof eq> | undefined;
        if (!isAdmin) {
          customerWhereClause = eq(subscriptionCustomers.id, +ctx.user.id);
        } else if (search) {
          customerWhereClause = ilike(subscriptionCustomers.title, `%${search}%`);
        }

        const baseQuery = db
          .selectDistinct({ subscriptions })
          .from(subscriptions)
          .leftJoin(
            subscriptionsToCustomers,
            eq(subscriptions.id, subscriptionsToCustomers.subscriptionId),
          )
          .leftJoin(
            subscriptionCustomers,
            eq(subscriptionsToCustomers.customerId, subscriptionCustomers.id),
          );

        // Apply filters: if we have customer filters, apply them; otherwise get all subscriptions
        const queryWithFilters = customerWhereClause
          ? baseQuery.where(customerWhereClause)
          : baseQuery;

        const [allSubscriptionsRaw, totalCountResult] = await Promise.all([
          queryWithFilters.orderBy(sortFn(sortColumn)).offset(skip).limit(itemsPerPage),
          !isAdmin
            ? db
                .select({ count: sql<number>`count(distinct ${subscriptions.id})` })
                .from(subscriptions)
                .leftJoin(
                  subscriptionsToCustomers,
                  eq(subscriptions.id, subscriptionsToCustomers.subscriptionId),
                )
                .leftJoin(
                  subscriptionCustomers,
                  eq(subscriptionsToCustomers.customerId, subscriptionCustomers.id),
                )
                .where(eq(subscriptionCustomers.id, +ctx.user.id))
            : search
              ? db
                  .select({ count: sql<number>`count(distinct ${subscriptions.id})` })
                  .from(subscriptions)
                  .leftJoin(
                    subscriptionsToCustomers,
                    eq(subscriptions.id, subscriptionsToCustomers.subscriptionId),
                  )
                  .leftJoin(
                    subscriptionCustomers,
                    eq(subscriptionsToCustomers.customerId, subscriptionCustomers.id),
                  )
                  .where(ilike(subscriptionCustomers.title, `%${search}%`))
              : db.$count(subscriptions),
        ]);

        const allSubscriptions = allSubscriptionsRaw.map((raw) => raw.subscriptions);

        // Get customer IDs for each subscription
        const subscriptionIds = allSubscriptions.map((s) => s.id);
        const customerRelations =
          subscriptionIds.length > 0
            ? await db
                .select({
                  subscriptionId: subscriptionsToCustomers.subscriptionId,
                  customerId: subscriptionsToCustomers.customerId,
                })
                .from(subscriptionsToCustomers)
                .where(inArray(subscriptionsToCustomers.subscriptionId, subscriptionIds))
            : [];

        // Group customer IDs by subscription ID
        const customerIdsBySubscription = customerRelations.reduce(
          (acc, rel) => {
            if (!acc[rel.subscriptionId]) {
              acc[rel.subscriptionId] = [];
            }
            acc[rel.subscriptionId].push(rel.customerId);
            return acc;
          },
          {} as Record<number, number[]>,
        );

        // Add customerIds to each subscription
        const subscriptionsWithCustomers = allSubscriptions.map((sub) => ({
          ...sub,
          customerIds: customerIdsBySubscription[sub.id] || [],
        }));

        const totalCount =
          typeof totalCountResult === 'number'
            ? totalCountResult
            : Number(totalCountResult[0]?.count || 0);

        return { subscriptions: subscriptionsWithCustomers, total: totalCount };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to get subscriptions');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelikler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  createSubscription: authorizedProcedure
    .input(CreateSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const { customerIds = [], ...subscriptionData } = input;

        const [createdSubscription] = await db
          .insert(subscriptions)
          .values(subscriptionData)
          .returning({ id: subscriptions.id, creationDate: subscriptions.creationDate });

        // Insert customer relationships
        if (customerIds && customerIds.length > 0) {
          await db.insert(subscriptionsToCustomers).values(
            customerIds.map((customerId) => ({
              subscriptionId: createdSubscription.id,
              customerId,
            })),
          );
        }

        return {
          message: 'Abonelik başarıyla eklendi.',
          id: createdSubscription.id,
          creationDate: createdSubscription.creationDate,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'Failed to create subscription');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelik oluşturulurken bir hata ile karşılaşıldı.',
        });
      }
    }),

  updateSubscription: authorizedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateSubscriptionSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { customerIds, ...subscriptionData } = input.data;

        // Update subscription fields (excluding customerIds)
        const updatedSubscriptions = await db
          .update(subscriptions)
          .set(subscriptionData)
          .where(eq(subscriptions.id, input.id))
          .returning();

        if (!updatedSubscriptions.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Abonelik bulunamadı.',
          });
        }

        // Update customer relationships if customerIds is provided
        if (customerIds !== undefined) {
          // Delete existing relationships
          await db
            .delete(subscriptionsToCustomers)
            .where(eq(subscriptionsToCustomers.subscriptionId, input.id));

          // Insert new relationships
          if (customerIds.length > 0) {
            await db.insert(subscriptionsToCustomers).values(
              customerIds.map((customerId) => ({
                subscriptionId: input.id,
                customerId,
              })),
            );
          }
        }

        return {
          updatedOn: updatedSubscriptions[0].updatedOn!,
          message: 'Abonelik başarıyla düzenlendi.',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'Failed to update subscription');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelik düzenlenirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  deleteSubscription: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await db.delete(subscriptions).where(eq(subscriptions.id, input.id));

        if (!result.rowCount) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Abonelik bulunamadı.',
          });
        }

        return { message: 'Abonelik başarıyla silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'Failed to delete subscription');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Abonelik silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
