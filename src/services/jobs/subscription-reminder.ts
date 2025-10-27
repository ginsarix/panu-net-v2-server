import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { and, eq, or } from 'drizzle-orm';

import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import { subscriptions } from '../../db/schema/subscription.js';
import { sendEmail } from '../../utils/send-email.js';
import { getLogger } from '../logger.js';
import { netgsm } from '../netgsm.js';

export const subscriptionReminder = async () => {
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
      subscriptionType: subscriptions.subscriptionType,
    })
    .from(subscriptionCustomers)
    .innerJoin(subscriptions, eq(subscriptionCustomers.id, subscriptions.userId))
    .where(whereClause);

  let emailsSent = 0;

  const smsMessages: { msg: string; no: string }[] = [];

  for (const customer of subscriptionCustomersResult) {
    const subscriptionExpiry = parseISO(customer.endDate);
    const daysLeft = differenceInCalendarDays(subscriptionExpiry, today);

    const subject = `${customer.subscriptionType[0].toUpperCase() + customer.subscriptionType.slice(1)} aboneliğinizi yenilemediğiniz takdirde ${daysLeft} gün sonra sona erecektir.`;

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
      getLogger().error(error, `Failed to send e-mail reminder to ${customer.email}`);
    }
  }
  try {
    await netgsm.sendRestSms({ messages: smsMessages, msgheader: env.NETGSM_HEADER });
  } catch (error) {
    getLogger().error(error, 'An error occurred while sending SMS messages');
  }
  return { emailsSent, smsSent: smsMessages.length };
};
