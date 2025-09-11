import type { FastifyRedis } from '@fastify/redis';
import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { v4 as uuid } from 'uuid';
import z from 'zod';

import { saltRounds } from '../../constants/auth';
import {
  emailInvalidMessage,
  passwordAtleast8CharactersMessage,
  serverErrorMessage,
} from '../../constants/messages';
import { OTP_TTL } from '../../constants/redis';
import { db } from '../../db/index';
import { users } from '../../db/schema/user';
import { getRedis } from '../../services/redis';
import type { Redis2FAContext } from '../../types/redis-2fa-context';
import type { RedisResetPasswordContext } from '../../types/redis-reset-password-context';
import { sendEmail } from '../../utils/send-email';
import { protectedProcedure, publicProcedure, router } from '../index';

const generateOtp = customAlphabet('0123456789', 6);

const AuthFormSchema = z.object({
  email: z.string().email(emailInvalidMessage),
  password: z.string().min(8, passwordAtleast8CharactersMessage),
});

const OTPSchema = z
  .string()
  .length(6)
  .regex(/^\d{6}$/, {
    message: '2FA Kodu 6 hane olmalıdır',
  });

const sendOtpEmail = async (to: string, code: string) =>
  await sendEmail({
    to,
    subject: 'E-posta Doğrulama',
    text: `E-posta doğrulama kodunuz: ${code}`,
    html: `<h3>${code}</h3> <br> <p>E-posta doğrulama kodunuz yukarıda yazmaktadır, eğer bunu siz istemediyseniz yönetici ile iletişime geçin</p>`,
  });

const checkOtpAttempts = async (redis: FastifyRedis, key: string) => {
  const MAX_ATTEMPTS = 5;
  const attempts = Number((await redis.get(key)) || '0');
  if (attempts >= MAX_ATTEMPTS) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.',
    });
  }
};

export const authRouter = router({
  login: publicProcedure.input(AuthFormSchema).mutation(async ({ input, ctx }) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, input.email));

      const fakeHash = '$2b$12$invalidhashstringforcomparison123456789012345678901234';
      const passwordCorrect = await bcrypt.compare(input.password, user?.password ?? fakeHash);

      if (!user || !passwordCorrect) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'E-posta veya parola yanlış.',
        });
      }

      const now = new Date();
      const lastLoginAt = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      const needsOtp = !lastLoginAt || now.getTime() - lastLoginAt.getTime() > twelveHoursMs;

      if (!needsOtp) {
        await db.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
        await ctx.req.session.regenerate();
        ctx.req.session.login = {
          id: String(user.id),
          name: user.name,
          email: input.email.trim().toLowerCase(),
          role: user.role as 'user' | 'admin',
        };
        return { success: true };
      }

      const redis = getRedis();
      const otpIdentifier = uuid();
      const redisKey = `2fa:${otpIdentifier}`;
      const verificationCode = generateOtp();
      const redisValue = {
        id: user.id,
        name: user.name,
        email: input.email,
        role: user.role,
        verificationCode,
      };
      await redis.set(redisKey, JSON.stringify(redisValue), 'EX', OTP_TTL);

      // mmmm...
      setImmediate(() => {
        sendOtpEmail(input.email, verificationCode).catch((err) => {
          console.error('Failed to send OTP email:', err);
        });
      });

      return { otpIdentifier, ttl: OTP_TTL };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('Error during login: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: serverErrorMessage,
      });
    }
  }),
  verifyEmail: publicProcedure
    .input(z.object({ identifier: z.string().uuid(), verificationCode: OTPSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        const redis = getRedis();
        const redisKey = `2fa:${input.identifier}`;
        const redisValue = await redis.get(redisKey);
        if (!redisValue) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Kodun süresi doldu, lütfen tekrar giriş yapın.',
          });
        }

        const ATTEMPT_TTL = OTP_TTL;
        const attemptsKey = `2fa:attempts:${input.identifier}`;
        await checkOtpAttempts(redis, attemptsKey);

        const twoFaContext = JSON.parse(redisValue) as Redis2FAContext;
        if (twoFaContext.verificationCode === input.verificationCode.trim()) {
          await ctx.req.session.regenerate();
          ctx.req.session.login = {
            id: String(twoFaContext.id),
            name: twoFaContext.name,
            email: twoFaContext.email,
            role: twoFaContext.role,
          };

          await db
            .update(users)
            .set({ lastLoginAt: new Date() })
            .where(eq(users.id, Number(twoFaContext.id)));
        } else {
          await redis.incr(attemptsKey);
          await redis.expire(attemptsKey, ATTEMPT_TTL);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Doğrulama kodu yanlış.',
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Error during verifying email: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: serverErrorMessage,
        });
      }
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        newPassword: z.string().min(8, passwordAtleast8CharactersMessage),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.email, input.email));

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Kullanıcı bulunamadı',
          });
        }

        const redis = getRedis();
        const otpIdentifier = uuid();
        const redisKey = `passwordResetVerification:${otpIdentifier}`;
        const verificationCode = generateOtp();
        const redisValue: RedisResetPasswordContext = {
          email: input.email,
          newPassword: input.newPassword,
          verificationCode,
        };

        await redis.set(redisKey, JSON.stringify(redisValue), 'EX', OTP_TTL);

        setImmediate(() => {
          sendOtpEmail(user.email, verificationCode).catch((error) => {
            console.error('Error occured while sending email: ', error);
          });
        });

        return { otpIdentifier, ttl: OTP_TTL };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error in resetPasssword endpoint: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: serverErrorMessage,
        });
      }
    }),
  verifyPasswordReset: publicProcedure
    .input(
      z.object({
        identifier: z.string().uuid(),
        verificationCode: OTPSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const redis = getRedis();
        const redisKey = `passwordResetVerification:${input.identifier}`;
        const redisValue = await redis.get(redisKey);

        if (!redisValue) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Kodun süresi doldu, lütfen yeni kod alın.',
          });
        }

        const ATTEMPT_TTL = OTP_TTL;
        const attemptsKey = `passwordResetVerification:attempts:${input.identifier}`;
        await checkOtpAttempts(redis, attemptsKey);

        const resetPasswordContext = JSON.parse(redisValue) as RedisResetPasswordContext;

        if (resetPasswordContext.verificationCode === input.verificationCode.trim()) {
          const hashedNewPassword = await bcrypt.hash(resetPasswordContext.newPassword, saltRounds);

          await db
            .update(users)
            .set({ password: hashedNewPassword })
            .where(eq(users.email, resetPasswordContext.email));
        } else {
          await redis.incr(attemptsKey);
          await redis.expire(attemptsKey, ATTEMPT_TTL);
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Doğrulama kodu yanlış.',
          });
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Error during verifying password reset: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: serverErrorMessage,
        });
      }
    }),
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.req.session.destroy();
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('Error during logout', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: serverErrorMessage,
      });
    }
  }),
  getLogin: publicProcedure.query(({ ctx }) => {
    try {
      return ctx.req.session.login;
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('Error while getting login: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: serverErrorMessage,
      });
    }
  }),
});
