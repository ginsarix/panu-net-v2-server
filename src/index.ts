import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySession from '@fastify/session';
import fastifyRedis from '@fastify/redis';
import * as dotenv from 'dotenv';
import routes from './routes/routes';
import RedisStore from 'fastify-session-redis-store';
import fastifyCors from '@fastify/cors';
import { setRedis } from './services/redis.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const fastify = Fastify();

await fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});

fastify.register(fastifyRedis, {
  host: 'localhost',
  port: 6379,
});

fastify.addHook('onReady', async () => {
  setRedis(fastify.redis);
});

fastify.register(fastifyCookie);

fastify.register(async (instance) => {
  instance.register(fastifySession, {
    secret: process.env.REDIS_SECRET as string,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
    saveUninitialized: false,
    store: new RedisStore({
      client: instance.redis,
      prefix: 'myapp:',
    }),
  });
});

fastify.register(routes, { prefix: '/api' });

fastify.listen({ port: PORT }, (err, address) => {
  if (err) throw err;
  console.log(`API server is running on ${address}`);
});
