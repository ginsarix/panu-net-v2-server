import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { customAlphabet } from 'nanoid';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { saltRounds } from '../../constants/auth.js';
import { emailVerificationTemplate } from '../../constants/email.js';
import {
  emailInvalidMessage,
  passwordAtleast8CharactersMessage,
} from '../../constants/messages.js';
import { DEVICE_TTL, OTP_TTL } from '../../constants/redis.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/user.js';
import { getRedis } from '../../services/redis.js';
import type { Redis2FAContext } from '../../types/redis-2fa-context.js';
import type { RedisResetPasswordContext } from '../../types/redis-reset-password-context.js';
import { generateRandomHex } from '../../utils/crypto.js';
import { sendEmail } from '../../utils/send-email.js';
import { protectedProcedure, publicProcedure, router } from '../index.js';
import { logEvent } from '../../utils/event-log.js';
import { stripSensitive } from '../../utils/parsing.js';

const generateOtp = customAlphabet('0123456789', 6);

const AuthFormSchema = z.object({
  email: z.string().email(emailInvalidMessage),
  password: z.string().min(8, passwordAtleast8CharactersMessage),
  deviceToken: z.string().optional(),
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
    html: emailVerificationTemplate(code),
  });

const checkOtpAttempts = async (redis: Redis, key: string) => {
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
    const [user] = await db.select().from(users).where(eq(users.email, input.email));

    if (!user) {
      // prevent timing attacks
      await bcrypt.hash('dummy', saltRounds);
      logEvent({
        resourceType: 'oturum',
        action: 'giriş başarısız - kullanıcı bulunamadı',
        actorId: null,
        status: 'başarısız',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'E-posta veya parola yanlış.',
      });
    }

    const passwordCorrect = await bcrypt.compare(input.password, user.password);

    if (!passwordCorrect) {
      logEvent({
        resourceType: 'oturum',
        action: 'giriş başarısız - yanlış parola',
        actorId: user.id,
        status: 'başarısız',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'E-posta veya parola yanlış.',
      });
    }

    const fake2Fa = process.env.FAKE_2FA === 'true';

    const redis = getRedis();
    let needsOtp = true;
    if (input.deviceToken) {
      const deviceKey = `device:${input.deviceToken}`;
      const deviceUserId = await redis.get(deviceKey);

      if (deviceUserId === String(user.id)) {
        needsOtp = false;
      }
    }

    if (!needsOtp) {
      const deviceToken = generateRandomHex();
      const deviceKey = `device:${deviceToken}`;

      await redis.set(deviceKey, String(user.id), 'EX', DEVICE_TTL);

      ctx.req.session.set('login', {
        id: String(user.id),
        name: user.name,
        email: input.email.trim().toLowerCase(),
        role: user.role as 'user' | 'admin',
      });
      await ctx.req.session.save();

      logEvent({
        resourceType: 'oturum',
        action: 'giriş yapıldı',
        actorId: user.id,
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { success: true, deviceToken };
    }

    const otpIdentifier = uuid();
    const redisKey = `2fa:${otpIdentifier}`;
    const verificationCode = fake2Fa ? '000000' : generateOtp();
    const redisValue = {
      id: user.id,
      name: user.name,
      email: input.email,
      role: user.role,
      verificationCode,
    };
    await redis.set(redisKey, JSON.stringify(redisValue), 'EX', OTP_TTL);

    sendOtpEmail(input.email, verificationCode).catch((err) => {
      ctx.req.log.error(err, 'Failed to send OTP email');
    });

    return { otpIdentifier, ttl: OTP_TTL };
  }),

  verifyEmail: publicProcedure
    .input(z.object({ identifier: z.string().uuid(), verificationCode: OTPSchema }))
    .mutation(async ({ input, ctx }) => {
      const redis = getRedis();
      const redisKey = `2fa:${input.identifier}`;
      const redisValue = await redis.get(redisKey);
      if (!redisValue) {
        logEvent({
          resourceType: 'oturum',
          action: 'giriş başarısız - OTP süresi doldu',
          actorId: null,
          status: 'başarısız',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kodun süresi doldu, lütfen tekrar giriş yapın.',
        });
      }

      const ATTEMPT_TTL = OTP_TTL;
      const attemptsKey = `2fa:attempts:${input.identifier}`;
      const twoFaContext = JSON.parse(redisValue) as Redis2FAContext;

      try {
        await checkOtpAttempts(redis, attemptsKey);
      } catch {
        logEvent({
          resourceType: 'oturum',
          action: 'giriş başarısız - maksimum OTP denemesi aşıldı',
          actorId: Number(twoFaContext.id),
          status: 'başarısız',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
      }

      if (twoFaContext.verificationCode === input.verificationCode.trim()) {
        const deviceToken = generateRandomHex();
        const deviceKey = `device:${deviceToken}`;

        await redis.set(deviceKey, twoFaContext.id, 'EX', DEVICE_TTL);

        ctx.req.session.set('login', {
          id: String(twoFaContext.id),
          name: twoFaContext.name,
          email: twoFaContext.email,
          role: twoFaContext.role,
        });
        await ctx.req.session.save();

        // invalidate otp
        await redis.del(redisKey);
        await redis.del(attemptsKey);
        //

        logEvent({
          resourceType: 'oturum',
          action: 'giriş yapıldı',
          actorId: Number(twoFaContext.id),
          status: 'başarılı',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
        return { success: true, deviceToken };
      } else {
        await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, ATTEMPT_TTL);
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Doğrulama kodu yanlış.',
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
    .mutation(async ({ input, ctx }) => {
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

      const hashedNewPassword = await bcrypt.hash(input.newPassword, saltRounds);
      const redisValue: RedisResetPasswordContext = {
        email: input.email,
        newPassword: hashedNewPassword,
        verificationCode,
      };

      await redis.set(redisKey, JSON.stringify(redisValue), 'EX', OTP_TTL);

      setImmediate(() => {
        sendOtpEmail(user.email, verificationCode).catch((error) => {
          ctx.req.log.error(error, 'Error occured while sending email');
        });
      });

      return { otpIdentifier, ttl: OTP_TTL };
    }),

  verifyPasswordReset: publicProcedure
    .input(
      z.object({
        identifier: z.string().uuid(),
        verificationCode: OTPSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const redis = getRedis();
      const redisKey = `passwordResetVerification:${input.identifier}`;
      const redisValue = await redis.get(redisKey);

      if (!redisValue) {
        logEvent({
          resourceType: 'kullanıcı',
          action: 'parola sıfırlama başarısız - OTP süresi doldu',
          actorId: null,
          status: 'başarısız',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
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
        await db
          .update(users)
          .set({ password: resetPasswordContext.newPassword })
          .where(eq(users.email, resetPasswordContext.email));

        // invalidate otp
        await redis.del(redisKey);
        await redis.del(attemptsKey);
        //

        logEvent({
          resourceType: 'kullanıcı',
          action: 'parola sıfırlandı',
          actorId: null,
          status: 'başarılı',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
      } else {
        await redis.incr(attemptsKey);
        await redis.expire(attemptsKey, ATTEMPT_TTL);
        logEvent({
          resourceType: 'kullanıcı',
          action: 'parola sıfırlama başarısız - yanlış OTP',
          actorId: null,
          status: 'başarısız',
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        });
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Doğrulama kodu yanlış.',
        });
      }
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(8, passwordAtleast8CharactersMessage),
        newPassword: z.string().min(8, passwordAtleast8CharactersMessage),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const [user] = await db.select().from(users).where(eq(users.id, +ctx.user.id));
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Kullanıcı bulunamadı',
        });
      }
      const passwordCorrect = await bcrypt.compare(input.currentPassword, user.password);
      if (!passwordCorrect) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Parola yanlış.',
        });
      }
      const hashedNewPassword = await bcrypt.hash(input.newPassword, saltRounds);
      await db.update(users).set({ password: hashedNewPassword }).where(eq(users.id, user.id));

      logEvent({
        resourceType: 'kullanıcı',
        resourceId: String(user.id),
        action: 'parola değiştirildi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Parola başarıyla değiştirildi.' };
    }),

  logout: protectedProcedure
    .input(z.object({ deviceToken: z.string().optional() }).optional())
    .mutation(async ({ input, ctx }) => {
      if (input?.deviceToken) {
        const redis = getRedis();
        const deviceKey = `device:${input.deviceToken}`;
        await redis.del(deviceKey);
      }

      logEvent({
        resourceType: 'oturum',
        action: 'çıkış yapıldı',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      await ctx.req.session.destroy();
    }),

  getLogin: publicProcedure.query(async ({ ctx }) => {
    const login = ctx.req.session.get('login');
    if (login) {
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, +login.id));
      return stripSensitive((await db.select().from(users).where(eq(users.id, +login.id)))[0]);
    }
    return null;
  }),
});
