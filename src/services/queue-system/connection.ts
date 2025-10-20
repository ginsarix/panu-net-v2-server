import { type ConnectionOptions } from 'bullmq';
import { Redis } from 'ioredis';

let redis: Redis | null = null;

function getRedis() {
  if (!redis) {
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
    });
  }
  return redis;
}

export const connection: ConnectionOptions = getRedis();
