import { Worker } from 'bullmq';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { eq, lte } from 'drizzle-orm';

import { db } from '../../../db/index.js';
import { subscriptionCustomers } from '../../../db/schema/subscription-customer.js';
import { subscriptions } from '../../../db/schema/subscription.js';
import { sendEmail } from '../../../utils/send-email.js';
import { connection } from '../connection.js';
import { queueName } from '../queues.js';

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

    for (const customer of subscriptionCustomersResult) {
      const subscriptionExpiry = parseISO(customer.endDate);
      const daysLeft = differenceInCalendarDays(subscriptionExpiry, today);

      const subject =
        daysLeft >= 0
          ? `Subscription will expire in ${daysLeft} days`
          : `Subscription expired ${Math.abs(daysLeft)} days ago`;

      try {
        await sendEmail({ to: customer.email, subject });
        emailsSent++;
      } catch (err) {
        console.error(`Failed to send email to ${customer.email}`, err);
      }
    }

    return emailsSent;
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
