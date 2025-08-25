import { type FastifySessionObject } from '@fastify/session';
import { TRPCError, initTRPC } from '@trpc/server';
import { eq } from 'drizzle-orm';

import { unauthorizedErrorMessage } from '../constants/messages.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema/user.ts';
import { type Context } from './context.ts';

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure.use(async function doesUserExist(opts) {
  const { ctx } = opts;
  const login = ctx.req.session.login;

  if (login) {
    const user = await db.select().from(users).where(eq(users.id, +login.id));
    if (!user) await ctx.req.session.destroy();
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: login,
    },
  });
});

const loginCheck = async (session: FastifySessionObject) => {
  const login = session.login;

  if (!login) {
    throw new TRPCError({ message: unauthorizedErrorMessage, code: 'UNAUTHORIZED' });
  } else if (!(await db.select().from(users).where(eq(users.id, +login.id))).length) {
    await session.destroy();
  }

  return login;
};

export const protectedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  const login = await loginCheck(ctx.req.session);

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: login,
    },
  });
});

export const authorizedProcedure = t.procedure.use(async function isAuthorized(opts) {
  const { ctx } = opts;

  const login = await loginCheck(ctx.req.session);

  if (login.role !== 'admin') {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: unauthorizedErrorMessage,
    });
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: login,
    },
  });
});
