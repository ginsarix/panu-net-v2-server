import compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRedis from '@fastify/redis';
import fastifySession from '@fastify/session';
import { FastifyTRPCPluginOptions, fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import * as dotenv from 'dotenv';
import Fastify from 'fastify';
import metrics from 'fastify-metrics';
import RedisStore from 'fastify-session-redis-store';
import { readFileSync } from 'node:fs';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { setRedis } from './services/redis.ts';
import { createContext } from './trpc/context.ts';
import { type AppRouter, appRouter } from './trpc/router';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  http2: true,
  https: {
    key: readFileSync(path.join(__dirname, '../key.pem')),
    cert: readFileSync(path.join(__dirname, '../cert.pem')),
  },
});

await fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN!,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

fastify.register(fastifyRedis, {
  password: process.env.REDIS_SECRET!,
  host: 'localhost',
  port: 6379,
});

fastify.addHook('onReady', () => {
  setRedis(fastify.redis);
});

await fastify.register(fastifyCookie);

await fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET!,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
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

fastify.listen({ port: PORT }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`API server is running on ${address}
Swagger UI on ${address}/docs
Metrics on ${address}/metrics
  `);
});
