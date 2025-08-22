import { Queue } from 'bullmq';

import { connection } from './connection';

export const queueName = 'subscriptionExpiryEmails';

export const queue = new Queue(queueName, { connection });
