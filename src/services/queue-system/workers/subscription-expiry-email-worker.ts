import { Worker } from 'bullmq';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { eq, lte } from 'drizzle-orm';

import { db } from '../../../db';
import { subscriptions } from '../../../db/schema/subscription';
import { subscriptionCustomers } from '../../../db/schema/subscription-customer';
import { sendEmail } from '../../../utils/send-email';
import { connection } from '../connection';
import { queueName } from '../queues';

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`Processing job: "Name: ${job.name} | Id: ${job.id}"`);

    const today = new Date();
    const subscriptionCustomersResult = await db
      .select({ email: subscriptionCustomers.email, endDate: subscriptions.endDate })
      .from(subscriptionCustomers)
      .innerJoin(subscriptions, eq(subscriptionCustomers.id, subscriptions.userId))
      .where(lte(subscriptions.endDate, addDays(today, 30).toISOString().split('T')[0]));

    let emailsSent = 0;

    const promises = subscriptionCustomersResult.map(async (customer) => {
      const subscriptionExpiry = parseISO(customer.endDate);
      const daysLeft = differenceInCalendarDays(subscriptionExpiry, today);

      const conditions = [
        daysLeft <= 30 && daysLeft > 15,
        daysLeft <= 15 && daysLeft > 7,
        daysLeft <= 7 && daysLeft >= 0,
        daysLeft < 0,
      ];

      if (!conditions.some(Boolean)) return Promise.resolve();

      const subject =
        daysLeft >= 0
          ? `Subscription will expire in ${daysLeft} days`
          : `Subscription expired ${Math.abs(daysLeft)} days ago`;

      try {
        return await sendEmail({ to: customer.email, subject });
        emailsSent++;
      } catch (err) {
        console.error(`Failed to send email to ${customer.email}`, err);
      }
    });

    await Promise.all(promises);

    return { emailsSent };
  },
  { connection },
);

worker.on('completed', (job, returnValue) =>
  console.log(`Job "Name: ${job.name} | Id: ${job.id}" completed with the result: ${returnValue}`),
);
worker.on('failed', (job, err) =>
  console.log(`Job "Name: ${job?.name} | Id: ${job?.id}" failed: ${err.message}`),
);

process.on('SIGTERM', () => {
  void (async () => {
    await worker.close();
    process.exit(0);
  })();
});
