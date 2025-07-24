import { FastifyRedis } from '@fastify/redis';

let redisInstance: FastifyRedis | null = null;

export function setRedis(client: FastifyRedis) {
  redisInstance = client;
}

export function getRedis() {
  if (!redisInstance) throw new Error('Redis not initialized');
  return redisInstance;
}
