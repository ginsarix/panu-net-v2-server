import { TRPCError } from '@trpc/server';
import { asc, desc, eq, ilike } from 'drizzle-orm';
import { z } from 'zod';

import { emailAlreadyExistsMessage, phoneAlreadyExistsMessage } from '../../constants/messages';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination';
import { db } from '../../db/index';
import { subscriptionCustomers } from '../../db/schema/subscription-customer';
import {
  CreateSubscriptionCustomerSchema,
  UpdateSubscriptionCustomerSchema,
} from '../../services/zod-validations/subscription-customer';
import { authorizedProcedure, router } from '../index';

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
    .query(async ({ input }) => {
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
        console.error('Failed to get subscription customers: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteriler getirilirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  createSubscriptionCustomer: authorizedProcedure
    .input(CreateSubscriptionCustomerSchema)
    .mutation(async ({ input }) => {
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

        const [result] = await db.insert(subscriptionCustomers).values(input).returning({
          id: subscriptionCustomers.id,
          creationDate: subscriptionCustomers.creationDate,
        });

        return {
          message: 'Müşteri başarıyla oluşturuldu.',
          id: result.id,
          creationDate: result.creationDate,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Failed to create subscription customer: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri oluşturulurken bir hata ile karşılaşıldı.',
        });
      }
    }),
  updateSubscriptionCustomer: authorizedProcedure
    .input(z.object({ id: z.number().int().positive(), data: UpdateSubscriptionCustomerSchema }))
    .mutation(async ({ input }) => {
      try {
        const updatedSubscriptionCustomer = await db
          .update(subscriptionCustomers)
          .set(input.data)
          .where(eq(subscriptionCustomers.id, input.id))
          .returning();

        if (!updatedSubscriptionCustomer.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Müşteri bulunamadı.',
          });
        }

        return {
          updatedOn: updatedSubscriptionCustomer[0].updatedOn!,
          message: 'Müşteri başarıyla düzenlendi.',
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('An error occurred while updating subscription customer: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri düzenlenilirken bir hata ile karşılaşıldı.',
        });
      }
    }),
  deleteSubscriptionCustomer: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
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

        console.error('An error occurred while deleting subscription customer: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Müşteri silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
