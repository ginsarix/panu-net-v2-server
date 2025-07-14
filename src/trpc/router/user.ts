import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import { asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { publicProcedure, router } from '../';
import { saltRounds } from '../../constants/auth.ts';
import { couldntFetchUsersMessage, userNotFoundMessage } from '../../constants/messages.ts';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.ts';
import { CACHE_TTL } from '../../constants/redis.ts';
import { db } from '../../db';
import { users } from '../../db/schema/user';
import { getRedis, ttlToHeader } from '../../services/redis.ts';
import { CreateUserSchema, UpdateUserSchema } from '../../services/zod-validations/user.ts';
import { PublicUser, User } from '../../types/user.ts';

const stripSensitive = (user: User): PublicUser => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
};

export const userRouter = router({
  getUsers: publicProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sort: z.enum(['creationDate', 'updatedOn', 'name', 'email']).default('creationDate'),
        order: z.enum(['asc', 'desc']).default('desc'),
        search: z.string().default(''),
      }),
    )
    .query(async ({ input, ctx }) => {
      try {
        const { page, itemsPerPage, sort, order, search } = input;
        const skip = (page - 1) * itemsPerPage;
        const redis = getRedis();

        const cacheKey = `users:${page}:${itemsPerPage}:${sort}:${order}:${search}`;
        const countKey = `users:count:${search}`;

        const [cachedUsers, cachedCount] = await Promise.all([
          redis.get(cacheKey),
          redis.get(countKey),
        ]);

        if (cachedUsers && cachedCount) {
          ctx.res.header('X-Cache-Status', 'HIT');
          await ttlToHeader(cacheKey, ctx.res);
          return {
            users: JSON.parse(cachedUsers) as PublicUser[],
            total: parseInt(cachedCount),
          };
        }

        const sortableColumns = {
          creationDate: users.creationDate,
          updatedOn: users.updatedOn,
          name: users.name,
          email: users.email,
        };

        const sortColumn = sortableColumns[sort];
        const sortFn = order === 'asc' ? asc : desc;
        const whereClause = search ? ilike(users.name, `%${search}%`) : undefined;

        const [fetchedUsers, totalCount] = await Promise.all([
          db.query.users.findMany({
            where: whereClause,
            orderBy: sortFn(sortColumn),
            offset: skip,
            limit: itemsPerPage,
          }),
          db
            .select({
              total: sql<number>`COUNT
                (*)`,
            })
            .from(users)
            .where(whereClause ?? sql`TRUE`),
        ]);

        const result = fetchedUsers.map(stripSensitive);

        await Promise.all([
          redis.set(cacheKey, JSON.stringify(result)),
          redis.expire(cacheKey, CACHE_TTL),
          redis.set(countKey, totalCount[0].total),
          redis.expire(countKey, CACHE_TTL),
        ]);

        return {
          users: result,
          total: totalCount[0].total,
          cached: false,
        };
      } catch (error) {
        console.error('Failed to fetch users: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchUsersMessage,
        });
      }
    }),

  getUser: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, input.id))
          .then(rows => rows[0]);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        return stripSensitive(user);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to fetch user: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchUsersMessage,
        });
      }
    }),

  createUser: publicProcedure.input(CreateUserSchema).mutation(async ({ input }) => {
    try {
      const userDto = { ...input };
      userDto.password = await bcrypt.hash(userDto.password, saltRounds);

      await db.insert(users).values(userDto);

      return { message: 'Kullanıcı başarıyla oluşturuldu.' };
    } catch (error) {
      console.error('Failed to create user: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Kullanıcı oluşturulurken bir hata ile karşılaşıldı.',
      });
    }
  }),

  updateUser: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateUserSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const { id, data: updateDto } = input;

        if (updateDto.password) {
          updateDto.password = await bcrypt.hash(updateDto.password, saltRounds);
        }

        const result = await db.update(users).set(updateDto).where(eq(users.id, id));

        if (result.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        return { message: 'Kullanıcı güncellendi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to update user: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Kullanıcı düzenlenirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteUser: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      try {
        const user = await db
          .select()
          .from(users)
          .where(eq(users.id, input.id))
          .then(rows => rows[0]);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const result = await db.delete(users).where(eq(users.id, user.id));

        if (result.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        return { message: 'Kullanıcı silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to delete user: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Kullanıcı silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteUsers: publicProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input }) => {
      try {
        const { ids } = input;

        if (ids.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: "Kullanıcı ID'leri gereklidir.",
          });
        }

        const existingUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, ids));

        const existingIds = new Set(existingUsers.map(u => u.id));

        const result = await db.delete(users).where(inArray(users.id, ids));

        if (result.rowCount === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const results = ids.map(id => ({
          id,
          status: existingIds.has(id),
          message: existingIds.has(id) ? 'Kullanıcı silindi' : 'Kullanıcı bulunamadı',
        }));

        return {
          message:
            result.rowCount !== ids.length
              ? 'Bazı kullanıcılar silindi, bazıları bulunamadı.'
              : 'Silme operasyonu hatasız geçti',
          deletedRows: result.rowCount,
          results,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('An error occurred while deleting users: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Kullanıcılar silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
