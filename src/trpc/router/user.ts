import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import { asc, desc, eq, ilike, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { saltRounds } from '../../constants/auth.js';
import {
  couldntFetchUsersMessage,
  emailAlreadyExistsMessage,
  userNotFoundMessage,
} from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { usersToCompanies } from '../../db/schema/user-company.js';
import { users } from '../../db/schema/user.js';
import { CreateUserSchema, UpdateUserSchema } from '../../services/zod-validations/user.js';
import type { User } from '../../types/user';
import { authorizedProcedure, router } from '../index.js';

const stripSensitive = (user: User) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = user;
  return rest;
};

export const userRouter = router({
  getUsers: authorizedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        itemsPerPage: z.number().min(1).max(100).default(DEFAULT_ITEMS_PER_PAGE),
        sortBy: z
          .array(
            z
              .object({
                key: z.enum(['creationDate', 'updatedOn', 'name', 'email']),
                order: z.enum(['asc', 'desc']),
              })
              .strict(),
          )
          .default([])
          .transform((val) => (!val.length ? [{ key: 'creationDate', order: 'desc' }] : val)),
        search: z.string().max(256).default(''),
      }),
    )
    .query(async ({ input }) => {
      try {
        const { page, itemsPerPage, sortBy, search } = input;

        const skip = (page - 1) * itemsPerPage;

        const sortableColumns = {
          creationDate: users.creationDate,
          updatedOn: users.updatedOn,
          name: users.name,
          email: users.email,
        } as const;

        const sortColumn = sortableColumns[sortBy[0].key as keyof typeof sortableColumns];
        const sortFn = sortBy[0].order === 'asc' ? asc : desc;
        const whereClause = search ? ilike(users.name, `%${search}%`) : undefined;

        const [fetchedUsers, totalCount] = await Promise.all([
          await db
            .select()
            .from(users)
            .where(whereClause)
            .orderBy(sortFn(sortColumn))
            .offset(skip)
            .limit(itemsPerPage),
          db.$count(users),
        ]);

        const result = fetchedUsers.map(stripSensitive);

        return {
          users: result,
          total: totalCount,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to fetch users: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: couldntFetchUsersMessage,
        });
      }
    }),

  getUser: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, input.id));

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

  createUser: authorizedProcedure.input(CreateUserSchema).mutation(async ({ input }) => {
    try {
      const emailAlreadyExists = (await db.select().from(users).where(eq(users.email, input.email)))
        .length;

      if (emailAlreadyExists) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: emailAlreadyExistsMessage,
        });
      }

      input.password = await bcrypt.hash(input.password, saltRounds);

      const [user] = await db
        .insert(users)
        .values(input)
        .returning({ id: users.id, creationDate: users.creationDate });

      const relationValues = input.companies.map((c) => ({ userId: user.id, companyId: c }));

      if (relationValues.length) await db.insert(usersToCompanies).values(relationValues);

      return {
        message: 'Kullanıcı başarıyla oluşturuldu.',
        id: user.id,
        creationDate: user.creationDate,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error('Failed to create user: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Kullanıcı oluşturulurken bir hata ile karşılaşıldı.',
      });
    }
  }),

  updateUser: authorizedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateUserSchema,
      }),
    )
    .mutation(async ({ input }) => {
      try {
        if (input.data.email) {
          const emailAlreadyExists = (
            await db.select().from(users).where(eq(users.email, input.data.email))
          ).length;

          if (emailAlreadyExists) {
            throw new TRPCError({
              code: 'CONFLICT',
              message: emailAlreadyExistsMessage,
            });
          }
        }

        if (input.data.password) {
          input.data.password = await bcrypt.hash(input.data.password, saltRounds);
        }

        const result = await db
          .update(users)
          .set(input.data)
          .where(eq(users.id, input.id))
          .returning({ id: users.id, updatedOn: users.updatedOn });

        if (!result.length) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const [serverValues] = result;

        return {
          message: 'Kullanıcı güncellendi.',
          updatedOn: serverValues.updatedOn,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        console.error('Failed to update user: ', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Kullanıcı düzenlenirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  deleteUser: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      try {
        const [user] = await db.select().from(users).where(eq(users.id, input.id));

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const result = await db.delete(users).where(eq(users.id, user.id));

        if (!result.rowCount) {
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

  deleteUsers: authorizedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input }) => {
      try {
        const { ids } = input;

        if (!ids.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: "Kullanıcı ID'leri gereklidir.",
          });
        }

        const existingUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, ids));

        const existingIds = new Set(existingUsers.map((u) => u.id));

        const result = await db.delete(users).where(inArray(users.id, ids));

        if (!result.rowCount) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const results = ids.map((id) => ({
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
