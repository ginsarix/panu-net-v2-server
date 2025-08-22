import { Worker } from 'bullmq';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { eq } from 'drizzle-orm';

import { db } from '../../../db';
import { subscriptions } from '../../../db/schema/subscription';
import { connection } from '../connection';
import { queueName } from '../queues';

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`Processing job: "Name: ${job.name} | Id: ${job.id}"`);

    const data: unknown = job.data;

    if (
      !data ||
      typeof data !== 'object' ||
      !('subscriptionId' in data) ||
      typeof data.subscriptionId !== 'number'
    ) {
      throw new Error(`Invalid job data: ${JSON.stringify(job.data)}`);
    }

    const result = await db
      .select({ endDate: subscriptions.endDate })
      .from(subscriptions)
      .where(eq(subscriptions.id, data.subscriptionId));

    if (!result.length) {
      throw new Error(`Subscription with the given ID, ${data.subscriptionId} not found`);
    }
    const { endDate } = result[0];

    const subscriptionExpiry = parseISO(endDate);

    const today = new Date();

    const daysLeft = differenceInCalendarDays(subscriptionExpiry, today);

    if (daysLeft > 30) return;

    const logMsg =
      daysLeft >= 0
        ? `Subscription will expire in ${daysLeft} days`
        : `Subscription expired ${Math.abs(daysLeft)} days ago`;

    if (daysLeft > 15) {
      console.log(logMsg);
    } else if (daysLeft <= 15 && daysLeft > 7) {
      console.log(logMsg);
    } else if (daysLeft <= 7 && daysLeft >= 0) {
      console.log(logMsg);
    } else if (daysLeft < 0) {
      console.log(logMsg);
    }
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
