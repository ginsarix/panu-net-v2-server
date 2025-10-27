import type { Session } from '@mgcrea/fastify-session';
import { TRPCError, initTRPC } from '@trpc/server';
import { eq } from 'drizzle-orm';
import superjson from 'superjson';

import { unauthorizedErrorMessage, unexpectedErrorMessage } from '../constants/messages.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/user.js';
import { checkCompanyLicense } from '../services/companiesDb.js';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure.use(async function doesUserExist(opts) {
  const { ctx } = opts;
  const login = ctx.req.session.get('login');

  if (login) {
    const user = await db.select().from(users).where(eq(users.id, +login.id));
    if (!user.length) await ctx.req.session.destroy();
  }

  return opts.next({
    ctx: {
      ...opts.ctx,
      user: login,
    },
  });
});

const loginCheck = async (session: Session) => {
  const login = session.get('login');

  const unauthorizedError = new TRPCError({
    message: unauthorizedErrorMessage,
    code: 'UNAUTHORIZED',
  });

  if (!login) throw unauthorizedError;

  const userExists = (await db.select().from(users).where(eq(users.id, +login.id))).length;

  if (!userExists) {
    await session.destroy();
    throw unauthorizedError;
  }

  return login;
};

export const protectedProcedure = t.procedure.use(async function isAuthed(opts) {
  const { ctx } = opts;

  const login = await loginCheck(ctx.req.session);

  const selectedCompanyId = ctx.req.session.get('selectedCompanyId');
  if (selectedCompanyId) {
    const [message, code] = await checkCompanyLicense(selectedCompanyId);
    if (code !== 'FORBIDDEN' && code !== null) {
      throw new TRPCError({
        code: code || 'INTERNAL_SERVER_ERROR',
        message: message! || unexpectedErrorMessage,
      });
    }

    if (code === null) {
      ctx.req.session.set('selectedCompanyId', undefined);
      await ctx.req.session.save();
    }
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: login,
    },
  });
});

export const authorizedProcedure = t.procedure.use(async function isAuthorized(opts) {
  const { ctx } = opts;

  const login = await loginCheck(ctx.req.session);

  if (login.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: unauthorizedErrorMessage,
    });
  }

  return opts.next({
    ctx: {
      ...ctx,
      user: login,
    },
  });
});
