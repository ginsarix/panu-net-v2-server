import compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifySession from '@mgcrea/fastify-session';
import RedisStore from '@mgcrea/fastify-session-redis-store';
import { SODIUM_AUTH } from '@mgcrea/fastify-session-sodium-crypto';
import { type FastifyTRPCPluginOptions, fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import 'dotenv/config';
import Fastify from 'fastify';
import metrics from 'fastify-metrics';
import Redis from 'ioredis';

import { env } from './config/env';
import { queue } from './services/queue-system/queues';
import { setRedis } from './services/redis';
import { createContext } from './trpc/context';
import { type AppRouter, appRouter } from './trpc/router/index';

const fastify = Fastify();

await fastify.register(fastifyCors, {
  origin: env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

const redis = new Redis(env.REDIS_URI || 'redis://127.0.0.1:6379');

fastify.addHook('onReady', async () => {
  setRedis(redis);
  await queue.add(
    'sendSubscriptionExpiryEmails',
    {},
    {
      repeat: {
        every: 24 * 60 * 60 * 1000, // 24 * 60 * 60 * 1000, // 24 hours in ms || debug -> 1 * 60 * 1000 // 1 minutes in milliseconds
        immediately: false,
      },
      removeOnComplete: true,
    },
  );
});

await fastify.register(fastifyCookie);

await fastify.register(fastifySession, {
  key: Buffer.from(env.SESSION_KEY, 'base64'),
  crypto: SODIUM_AUTH,
  store: new RedisStore({
    client: redis,
    ttl: 86400,
  }),
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 86400,
    sameSite: 'lax',
    domain: undefined,
  },
});

fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }: { path: string | undefined; error: Error | string }) {
      console.error(`Error in tRPC handler on path '${path}': `, error);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

await fastify.register(compress, {
  global: true,
  encodings: ['gzip'],
});
await fastify.register(metrics, {
  endpoint: '/metrics',
});

fastify.listen({ port: env.PORT }, (err: Error | null, address: string) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`API server is running on ${address}
Metrics on ${address}/metrics
  `);
});

process.on('SIGTERM', () => {
  process.exit(0);
});
