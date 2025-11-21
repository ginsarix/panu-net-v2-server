import type { Session } from '@mgcrea/fastify-session';
import { TRPCError } from '@trpc/server';
import { db } from '../db/index.js';
import { users } from '../db/schema/user.js';
import { unauthorizedErrorMessage } from '../constants/messages.js';
import { eq } from 'drizzle-orm';

export const loginCheck = async (session: Session) => {
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
