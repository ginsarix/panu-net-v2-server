import type Redis from 'ioredis';

let redisInstance: Redis | null = null;

export function setRedis(client: Redis) {
  redisInstance = client;
}

export function getRedis() {
  if (!redisInstance) throw new Error('Redis not initialized');
  return redisInstance;
}
