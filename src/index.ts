import 'dotenv/config';
import './instrument.js';
import compress from '@fastify/compress';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyCors from '@fastify/cors';
import fastifySession from '@mgcrea/fastify-session';
import RedisStore from '@mgcrea/fastify-session-redis-store';
import { type FastifyTRPCPluginOptions, fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import * as Sentry from '@sentry/node';
import Fastify from 'fastify';
import { Redis } from 'ioredis';
import cron from 'node-cron';
import * as rfs from 'rotating-file-stream';

import { env } from './config/env.js';
import { subscriptionReminder } from './services/jobs/subscription-reminder.js';
import { setLogger } from './services/logger.js';
import { setRedis } from './services/redis.js';
import { createContext } from './trpc/context.js';
import { type AppRouter, appRouter } from './trpc/router/index.js';

let logStream: NodeJS.WritableStream | undefined;

if (env.NODE_ENV === 'production') {
  const path = await import('node:path');
  const fs = await import('node:fs');

  const logPath = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logPath)) fs.mkdirSync(logPath);

  logStream = rfs.createStream('server.log', {
    path: logPath,
    size: '10M', // Rotate when file size exceeds 10MB
    interval: '1d', // Rotate daily
    maxFiles: 14, // Keep 14 days of logs
    compress: 'gzip', // Compress old log files
  });
}

export const fastify = Fastify({
  logger:
    env.NODE_ENV === 'development'
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : {
          stream: logStream,
        },
});

Sentry.setupFastifyErrorHandler(fastify);

await fastify.register(fastifyCors, {
  origin: env.CORS_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

const redis = new Redis(env.REDIS_URI);

fastify.addHook('onReady', () => {
  setRedis(redis);
  setLogger(fastify.log);

  // runs every day at 5 AM
  cron.schedule('0 5 * * *', async () => {
    const result = await subscriptionReminder();
    fastify.log.info(`Subscription reminder job completed: ${JSON.stringify(result)}`);
  });
});

await fastify.register(fastifyCookie);

await fastify.register(fastifyMultipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
});

await fastify.register(fastifySession, {
  key: Buffer.from(env.SESSION_KEY, 'base64'),
  store: new RedisStore({
    client: redis,
    ttl: 24 * 60 * 60, // 1 day
  }),
  cookie: {
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60, // 1 day
    sameSite: 'lax',
    domain: undefined,
  },
});

fastify.register(import('./router/file.js'));

fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: appRouter,
    createContext,
    onError({ path, error }: { path: string | undefined; error: Error | string }) {
      fastify.log.error(error, `Error in tRPC handler on path '${path}'`);
      Sentry.captureMessage(typeof error === 'string' ? error : error.message, {
        level: 'error',
        tags: {
          trpcPath: path,
        },
        contexts: {
          trpc: {
            path,
          },
        },
      });
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

await fastify.register(compress, {
  global: true,
  encodings: ['gzip'],
});

fastify.listen(
  { port: env.PORT, ...(env.NODE_ENV === 'production' && { host: '0.0.0.0' }) },
  (err: Error | null, address: string) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    console.log(`API server is running on ${address}`);
  },
);

process.on('SIGTERM', () => {
  process.exit(0);
});
