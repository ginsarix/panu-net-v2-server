import { FastifyRedis } from '@fastify/redis';
import { FastifyReply } from 'fastify';

let redisInstance: FastifyRedis | null = null;

export function setRedis(client: FastifyRedis) {
  redisInstance = client;
}

export function getRedis() {
  if (!redisInstance) throw new Error('Redis not initialized');
  return redisInstance;
}

export async function ttlToHeader(cacheKey: string, reply: FastifyReply) {
  const ttlSeconds = await redisInstance?.ttl(cacheKey);

  if (ttlSeconds === undefined || ttlSeconds < 0) return false;

  reply.header('X-Cache-TTL', ttlSeconds.toString());
  return true;
}
