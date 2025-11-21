import { TRPCError } from '@trpc/server';
import { asc, desc, eq, ilike, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { env } from '../../config/env.js';
import { emailAlreadyExistsMessage, phoneAlreadyExistsMessage } from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { subscriptionsToCustomers } from '../../db/schema/subscription-customer-junction.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import { sendRestSms } from '../../services/netgsm.js';
import {
  CreateSubscriptionCustomerSchema,
  UpdateSubscriptionCustomerSchema,
} from '../../services/zod-validations/subscription-customer.js';
import { sendEmail } from '../../utils/send-email.js';
import { authorizedProcedure, pageRoleProtectedProcedure, router } from '../index.js';

export const subscriptionCustomerRouter = router({
  getSubscriptionCustomers: pageRoleProtectedProcedure('CUSTOMER_VIEW')
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sortBy: z
          .array(
            z
              .object({
                key: z.enum([
                  'creationDate',
                  'customerCode',
                  'title',
                  'status',
                  'manager',
                  'email',
                ]),
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

        const sortableColumns = {
          creationDate: subscriptionCustomers.creationDate,
          customerCode: subscriptionCustomers.customerCode,
          title: subscriptionCustomers.title,
          status: subscriptionCustomers.status,
          manager: subscriptionCustomers.manager,
          email: subscriptionCustomers.email,
        } as const;

        const sortColumn = sortableColumns[sortBy[0].key as keyof typeof sortableColumns];
        const sortFn = sortBy[0].order === 'asc' ? asc : desc;
        const whereClause = search ? ilike(subscriptionCustomers.title, `%${search}%`) : undefined;

        const [allSubscriptionCustomers, totalCount] = await Promise.all([
          db
            .select()
            .from(subscriptionCustomers)
            .where(whereClause)
            .orderBy(sortFn(sortColumn))
            .offset(skip)
            .limit(itemsPerPage),
          db.$count(subscriptionCustomers, whereClause),
        ]);

        // Get subscription IDs for each customer
        const customerIds = allSubscriptionCustomers.map((c) => c.id);
        const subscriptionRelations =
          customerIds.length > 0
            ? await db
                .select({
                  customerId: subscriptionsToCustomers.customerId,
                  subscriptionId: subscriptionsToCustomers.subscriptionId,
                })
                .from(subscriptionsToCustomers)
                .where(inArray(subscriptionsToCustomers.customerId, customerIds))
            : [];

        // Group subscription IDs by customer ID
        const subscriptionIdsByCustomer = subscriptionRelations.reduce(
          (acc, rel) => {
            if (!acc[rel.customerId]) {
              acc[rel.customerId] = [];
            }
            acc[rel.customerId].push(rel.subscriptionId);
            return acc;
          },
          {} as Record<number, number[]>,
        );

        // Add subscriptionIds to each customer
        const customersWithSubscriptions = allSubscriptionCustomers.map((customer) => ({
          ...customer,
          subscriptionIds: subscriptionIdsByCustomer[customer.id] || [],
        }));

        return { subscriptionCustomers: customersWithSubscriptions, total: totalCount };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to get subscription customers');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteriler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  createSubscriptionCustomer: authorizedProcedure
    .input(CreateSubscriptionCustomerSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const emailAlreadyExists = (
          await db
            .select()
            .from(subscriptionCustomers)
            .where(eq(subscriptionCustomers.email, input.email))
        ).length;

        if (emailAlreadyExists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: emailAlreadyExistsMessage,
          });
        }

        if (input.remindExpiryWithSms && !input.phone) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'SMS hatırlatmaları seçildi ama telefon numarası girilmedi.',
          });
        }

        const phoneAlreadyExists = input.phone
          ? (
              await db
                .select()
                .from(subscriptionCustomers)
                .where(eq(subscriptionCustomers.phone, input.phone))
            ).length
          : false;

        if (phoneAlreadyExists) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: phoneAlreadyExistsMessage,
          });
        }

        const { subscriptionIds, ...customerData } = input;

        const [createdSubscriptionCustomer] = await db
          .insert(subscriptionCustomers)
          .values(customerData)
          .returning({
            id: subscriptionCustomers.id,
            creationDate: subscriptionCustomers.creationDate,
          });

        // Insert subscription relationships
        if (subscriptionIds && subscriptionIds.length > 0) {
          await db.insert(subscriptionsToCustomers).values(
            subscriptionIds.map((subscriptionId) => ({
              customerId: createdSubscriptionCustomer.id,
              subscriptionId,
            })),
          );
        }

        return {
          message: 'Müşteri başarıyla oluşturuldu.',
          id: createdSubscriptionCustomer.id,
          creationDate: createdSubscriptionCustomer.creationDate,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'Failed to create subscription customer');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri oluşturulurken bir hata ile karşılaşıldı.',
        });
      }
    }),
  updateSubscriptionCustomer: authorizedProcedure
    .input(z.object({ id: z.number().int().positive(), data: UpdateSubscriptionCustomerSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        const { subscriptionIds, ...customerData } = input.data;

        // Update customer fields (excluding subscriptionIds)
        const updatedSubscriptionCustomers = await db
          .update(subscriptionCustomers)
          .set(customerData)
          .where(eq(subscriptionCustomers.id, input.id))
          .returning({ updatedOn: subscriptionCustomers.updatedOn });

        if (!updatedSubscriptionCustomers.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Müşteri bulunamadı.',
          });
        }

        // Update subscription relationships if subscriptionIds is provided
        if (subscriptionIds !== undefined) {
          // Delete existing relationships
          await db
            .delete(subscriptionsToCustomers)
            .where(eq(subscriptionsToCustomers.customerId, input.id));

          // Insert new relationships
          if (subscriptionIds.length > 0) {
            await db.insert(subscriptionsToCustomers).values(
              subscriptionIds.map((subscriptionId) => ({
                customerId: input.id,
                subscriptionId,
              })),
            );
          }
        }

        return {
          updatedOn: updatedSubscriptionCustomers[0].updatedOn!,
          message: 'Müşteri başarıyla düzenlendi.',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'An error occurred while updating subscription customer');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri düzenlenilirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  deleteSubscriptionCustomer: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await db
          .delete(subscriptionCustomers)
          .where(eq(subscriptionCustomers.id, input.id));

        if (!result.rowCount) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Müşteri bulunamadı.',
          });
        }

        return { message: 'Müşteri başarıyla silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        ctx.req.log.error(error, 'An error occurred while deleting subscription customer');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  testNotification: authorizedProcedure
    .input(
      z.object({
        email: z.string().email(),
        phone: z.string().optional(),
        remindExpiryWithEmail: z.boolean(),
        remindExpiryWithSms: z.boolean(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        let emailsSent = 0;
        let smsSent = 0;

        if (input.remindExpiryWithEmail) {
          await sendEmail({ to: input.email, subject: 'Bildirim testi' });
          emailsSent++;
        }
        if (input.remindExpiryWithSms) {
          await sendRestSms({
            messages: [{ msg: 'Bildirim testi', no: input.phone! }],
            msgheader: env.NETGSM_HEADER,
          });

          smsSent++;
        }

        return { message: 'Bildirim testi tamamlandı', result: { emailsSent, smsSent } };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to test notification');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Notification test failed.',
        });
      }
    }),
});
