import { addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { and, eq, or } from 'drizzle-orm';

import { env } from '../../config/env.js';
import { db } from '../../db/index.js';
import { subscriptionsToCustomers } from '../../db/schema/subscription-customer-junction.js';
import { subscriptionCustomers } from '../../db/schema/subscription-customer.js';
import { subscriptions } from '../../db/schema/subscription.js';
import { sendEmail } from '../../utils/send-email.js';
import { getLogger } from '../logger.js';
import { sendRestSms } from '../netgsm.js';

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
    .from(subscriptions)
    .innerJoin(
      subscriptionsToCustomers,
      eq(subscriptions.id, subscriptionsToCustomers.subscriptionId),
    )
    .innerJoin(
      subscriptionCustomers,
      eq(subscriptionsToCustomers.customerId, subscriptionCustomers.id),
    )
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

        if (customer.phone) {
          smsMessages.push({ msg: subject, no: customer.phone });
        } else {
          getLogger().warn(`Skipping SMS for customer ${customer.email}: phone number is missing`);
        }
      } else if (customer.remindExpiryWithEmail) {
        await sendEmail({ to: customer.email, subject });
        emailsSent++;
      } else if (customer.remindExpiryWithSms) {
        if (customer.phone) {
          smsMessages.push({ msg: subject, no: customer.phone });
        } else {
          getLogger().warn(`Skipping SMS for customer ${customer.email}: phone number is missing`);
        }
      }
    } catch (error) {
      getLogger().error(error, `Failed to send reminder to ${customer.email}`);
    }
  }
  if (smsMessages.length > 0) {
    try {
      await sendRestSms({ messages: smsMessages, msgheader: env.NETGSM_HEADER });
    } catch (error) {
      getLogger().error(error, 'An error occurred while sending SMS messages');
      // Don't throw - we still want to return the email count even if SMS fails
    }
  }
  return { emailsSent, smsSent: smsMessages.length };
};
