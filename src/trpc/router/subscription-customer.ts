import { TRPCError } from '@trpc/server';
import { asc, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import { emailAlreadyExistsMessage, phoneAlreadyExistsMessage } from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import {
  CreateSubscriptionCustomerSchema,
  UpdateSubscriptionCustomerSchema,
} from '../../services/zod-validations/subscription-customer.js';
import { authorizedProcedure, router } from '../index.js';

export const subscriptionCustomerRouter = router({
  getSubscriptionCustomers: authorizedProcedure
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
          db.$count(subscriptionCustomers),
        ]);

        return { subscriptionCustomers: allSubscriptionCustomers, total: totalCount };
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

        const [createdSubscriptionCustomer] = await db
          .insert(subscriptionCustomers)
          .values(input)
          .returning({
            id: subscriptionCustomers.id,
            creationDate: subscriptionCustomers.creationDate,
          });

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
        const updatedSubscriptionCustomers = await db
          .update(subscriptionCustomers)
          .set(input.data)
          .where(eq(subscriptionCustomers.id, input.id))
          .returning({ updatedOn: subscriptionCustomers.updatedOn });

        if (!updatedSubscriptionCustomers.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Müşteri bulunamadı.',
          });
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
});
