import compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRedis from '@fastify/redis';
import fastifySession from '@fastify/session';
import { type FastifyTRPCPluginOptions, fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import 'dotenv/config';
import Fastify from 'fastify';
import metrics from 'fastify-metrics';
import RedisStore from 'fastify-session-redis-store';
import { readFileSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { env } from './config/env';
import { queue } from './services/queue-system/queues';
import { setRedis } from './services/redis';
import { createContext } from './trpc/context';
import { type AppRouter, appRouter } from './trpc/router/index';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sslConfig =
  env.NODE_ENV === 'production'
    ? {
        key: Buffer.from(env.SSL_KEY!, 'base64').toString('utf-8'),
        cert: Buffer.from(env.SSL_CERT!, 'base64').toString('utf-8'),
      }
    : {
        key: readFileSync(path.join(__dirname, '../key.pem')),
        cert: readFileSync(path.join(__dirname, '../cert.pem')),
      };

const fastify = Fastify({
  logger: true,
  https: sslConfig,
  http2: true,
});

await fastify.register(fastifyCors, {
  origin: env.CORS_ORIGIN || 'https://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

fastify.register(fastifyRedis, {
  password: env.REDIS_SECRET,
  host: 'localhost',
  port: 6379,
});

fastify.addHook('onReady', async () => {
  setRedis(fastify.redis);
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
  secret: env.SESSION_SECRET,
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8,
    sameSite: 'lax',
    domain: undefined,
  },
  saveUninitialized: false,
  store: new RedisStore({
    client: fastify.redis,
    prefix: 'myapp:',
  }),
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
