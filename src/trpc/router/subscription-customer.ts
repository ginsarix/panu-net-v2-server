import { TRPCError } from '@trpc/server';
import { asc, desc, eq, ilike } from 'drizzle-orm';
import z from 'zod';

import { emailAlreadyExistsMessage } from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import { CreateSubscriptionCustomerSchema } from '../../services/zod-validations/subscription-customer.js';
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
});
