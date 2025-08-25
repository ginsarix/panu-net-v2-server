import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { protectedProcedure, router } from '..';
import { db } from '../../db';
import { subscriptions } from '../../db/schema/subscription';
import { subscriptionCustomers } from '../../db/schema/subscription-customer';

export const subscriptionRouter = router({
  getSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    try {
      let allSubscriptions: (typeof subscriptions.$inferSelect)[];

      if (ctx.user.role === 'admin') {
        allSubscriptions = await db.select().from(subscriptions);
      } else {
        const allSubscriptionsRaw = await db
          .select({ subscriptions })
          .from(subscriptionCustomers)
          .innerJoin(subscriptions, eq(subscriptionCustomers.id, subscriptions.userId));

        allSubscriptions = allSubscriptionsRaw.map((raw) => raw.subscriptions);
      }

      return { subscriptions: allSubscriptions };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('Failed to create user: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Kullanıcı oluşturulurken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
