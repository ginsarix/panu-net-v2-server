import { Queue } from 'bullmq';

import { connection } from './connection.js';

export const queueName = 'subscriptionExpiryEmails';

export const queue = new Queue(queueName, { connection });
