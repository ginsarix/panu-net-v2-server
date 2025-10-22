import type { ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

import { env } from '../../config/env.js';

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(env.REDIS_URI);
  }
  return redis;
}

export const connection: ConnectionOptions = getRedis();
