import type { Session } from '@mgcrea/fastify-session';
import { TRPCError, initTRPC } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import superjson from 'superjson';

import { unauthorizedErrorMessage, unexpectedErrorMessage } from '../constants/messages.js';
import { PAGE_ROLE_KEYS } from '../constants/page-roles.js';
import { db } from '../db/index.js';
import { pageRoles } from '../db/schema/page-role.js';
import { usersToPageRoles } from '../db/schema/user-page-role.js';
import { users } from '../db/schema/user.js';
import { checkCompanyLicense } from '../services/companiesDb.js';
import type { Context } from './context.js';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  sse: {
    ping: {
      enabled: true,
      intervalMs: 2000,
    },
  },
});

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

export const pageRoleProtectedProcedure = (requiredRoleKey: keyof typeof PAGE_ROLE_KEYS) =>
  t.procedure.use(async function hasPageRole(opts) {
    const { ctx } = opts;

    const login = await loginCheck(ctx.req.session);

    // Admins bypass page role checks
    if (login.role === 'admin') {
      return opts.next({
        ctx: {
          ...opts.ctx,
          user: login,
        },
      });
    }

    // Get the page role by key
    const [pageRole] = await db
      .select()
      .from(pageRoles)
      .where(eq(pageRoles.key, PAGE_ROLE_KEYS[requiredRoleKey]));

    if (!pageRole) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Sayfa rolü bulunamadı.',
      });
    }

    // Check if user has this page role
    const [userPageRole] = await db
      .select()
      .from(usersToPageRoles)
      .where(
        and(eq(usersToPageRoles.userId, +login.id), eq(usersToPageRoles.pageRoleId, pageRole.id)),
      );

    if (!userPageRole) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Bu sayfaya erişim yetkiniz yoktur.',
      });
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

  if (login.role !== 'admin') {
    const selectedCompanyId = ctx.req.session.get('selectedCompanyId');
    if (selectedCompanyId) {
      const [message, code] = await checkCompanyLicense(selectedCompanyId);
      if (code !== 'FORBIDDEN' && code !== null) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message! || unexpectedErrorMessage,
        });
      }
      if (code === 'FORBIDDEN') {
        ctx.req.session.set('selectedCompanyId', undefined);
        await ctx.req.session.save();
      }
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
