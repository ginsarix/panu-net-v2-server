import { Worker } from 'bullmq';
import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { and, eq, or } from 'drizzle-orm';

import { db } from '../../../db/index';
import { subscriptions } from '../../../db/schema/subscription';
import { subscriptionCustomers } from '../../../db/schema/subscription-customer';
import { sendEmail } from '../../../utils/send-email';
import { netgsm } from '../../netgsm';
import { connection } from '../connection';
import { queueName } from '../queues';

const worker = new Worker(
  queueName,
  async (job) => {
    console.log(`Processing job: "Name: ${job.name} | Id: ${job.id}"`);

    const today = new Date();

    const dbEndDateEqCheck = (days: number) =>
      eq(subscriptions.endDate, addDays(today, days).toISOString().split('T')[0]);

    const dbEndDateChecks = [dbEndDateEqCheck(30), dbEndDateEqCheck(15), dbEndDateEqCheck(7)];

    const dbReminderChecks = [
      eq(subscriptionCustomers.remindExpiryWithEmail, true),
      eq(subscriptionCustomers.remindExpiryWithSms, true),
    ];

    const whereClause = and(or(...dbEndDateChecks), or(...dbReminderChecks));

    const subscriptionCustomersResult = await db
      .select({
        email: subscriptionCustomers.email,
        phone: subscriptionCustomers.phone,
        remindExpiryWithEmail: subscriptionCustomers.remindExpiryWithEmail,
        remindExpiryWithSms: subscriptionCustomers.remindExpiryWithSms,
        endDate: subscriptions.endDate,
      })
      .from(subscriptionCustomers)
      .innerJoin(subscriptions, eq(subscriptionCustomers.id, subscriptions.userId))
      .where(whereClause);

    let emailsSent = 0;

    const smsMessages: { msg: string; no: string }[] = [];

    for (const customer of subscriptionCustomersResult) {
      const subscriptionExpiry = parseISO(customer.endDate);
      const daysLeft = differenceInCalendarDays(subscriptionExpiry, today);

      const subject = `Aboneliğinizi yenilemediğiniz takdirde ${daysLeft} gün sonra sona erecektir.`;

      try {
        if (customer.remindExpiryWithEmail && customer.remindExpiryWithSms) {
          await sendEmail({ to: customer.email, subject });
          emailsSent++;

          smsMessages.push({ msg: subject, no: customer.phone! });
        } else if (customer.remindExpiryWithEmail) {
          await sendEmail({ to: customer.email, subject });
          emailsSent++;
        } else {
          smsMessages.push({ msg: subject, no: customer.phone! });
        }
      } catch (error) {
        console.error(`Failed to send e-mail reminder to ${customer.email}`, error);
      }
    }
    try {
      await netgsm.sendRestSms({ messages: smsMessages, msgheader: process.env.NETGSM_HEADER! });
    } catch (error) {
      console.error('An error occurred while sending SMS messages: ', error);
    }
    return { emailsSent, smsSent: smsMessages.length };
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
