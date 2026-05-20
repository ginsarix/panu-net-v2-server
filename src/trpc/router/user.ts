import { TRPCError } from '@trpc/server';
import * as bcrypt from 'bcrypt';
import { asc, desc, eq, ilike, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { saltRounds } from '../../constants/auth.js';
import { emailAlreadyExistsMessage, userNotFoundMessage } from '../../constants/messages.js';
import { DEFAULT_ITEMS_PER_PAGE } from '../../constants/pagination.js';
import { db } from '../../db/index.js';
import { usersToCompanies } from '../../db/schema/user-company.js';
import { usersToPageRoles } from '../../db/schema/user-page-role.js';
import { users } from '../../db/schema/user.js';
import { CreateUserSchema, UpdateUserSchema } from '../../services/zod-validations/user.js';
import { authorizedProcedure, router } from '../index.js';
import { logEvent } from '../../utils/event-log.js';
import { stripSensitive } from '../../utils/parsing.js';

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
        db
          .select()
          .from(users)
          .where(whereClause)
          .orderBy(sortFn(sortColumn))
          .offset(skip)
          .limit(itemsPerPage),
        db.$count(users),
      ]);

      const userIds = fetchedUsers.map((user) => user.id);
      const userCompanies =
        userIds.length > 0
          ? await db
              .select({
                userId: usersToCompanies.userId,
                companyId: usersToCompanies.companyId,
              })
              .from(usersToCompanies)
              .where(inArray(usersToCompanies.userId, userIds))
          : [];

      const companyIdsByUser = userCompanies.reduce(
        (acc, { userId, companyId }) => {
          if (!acc[userId]) {
            acc[userId] = [];
          }
          acc[userId].push(companyId);
          return acc;
        },
        {} as Record<number, number[]>,
      );

      const userPageRoles =
        userIds.length > 0
          ? await db
              .select({
                userId: usersToPageRoles.userId,
                pageRoleId: usersToPageRoles.pageRoleId,
              })
              .from(usersToPageRoles)
              .where(inArray(usersToPageRoles.userId, userIds))
          : [];

      const pageRoleIdsByUser = userPageRoles.reduce(
        (acc, { userId, pageRoleId }) => {
          if (!acc[userId]) {
            acc[userId] = [];
          }
          acc[userId].push(pageRoleId);
          return acc;
        },
        {} as Record<number, number[]>,
      );

      const result = fetchedUsers.map((user) => ({
        ...stripSensitive(user),
        companyIds: companyIdsByUser[user.id] || [],
        pageRoleIds: pageRoleIdsByUser[user.id] || [],
      }));

      return {
        users: result,
        total: totalCount,
      };
    }),

  getUser: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const [user] = await db.select().from(users).where(eq(users.id, input.id));

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: userNotFoundMessage,
        });
      }

      return stripSensitive(user);
    }),

  createUser: authorizedProcedure.input(CreateUserSchema).mutation(async ({ input, ctx }) => {
    const emailAlreadyExists = (await db.select().from(users).where(eq(users.email, input.email)))
      .length;

    if (emailAlreadyExists) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: emailAlreadyExistsMessage,
      });
    }

    input.password = await bcrypt.hash(input.password, saltRounds);

    const [createdUser] = await db
      .insert(users)
      .values(input)
      .returning({ id: users.id, creationDate: users.creationDate });

    const relationValues = input.companies.map((c) => ({ userId: createdUser.id, companyId: c }));

    if (relationValues.length) await db.insert(usersToCompanies).values(relationValues);

    if (input.pageRoles && input.pageRoles.length > 0) {
      const pageRoleValues = input.pageRoles.map((roleId) => ({
        userId: createdUser.id,
        pageRoleId: roleId,
      }));
      await db.insert(usersToPageRoles).values(pageRoleValues);
    }

    logEvent({
      resourceType: 'kullanıcı',
      resourceId: String(createdUser.id),
      action: 'oluşturuldu',
      actorId: Number(ctx.user.id),
      status: 'başarılı',
      ipAddress: ctx.req.ip,
      userAgent: ctx.req.headers['user-agent'] ?? null,
    });
    return {
      message: 'Kullanıcı başarıyla oluşturuldu.',
      id: createdUser.id,
      creationDate: createdUser.creationDate,
    };
  }),

  updateUser: authorizedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        data: UpdateUserSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
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

      const editedUsers = await db
        .update(users)
        .set(input.data)
        .where(eq(users.id, input.id))
        .returning({ id: users.id, updatedOn: users.updatedOn });

      if (!editedUsers.length) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: userNotFoundMessage,
        });
      }

      if (input.data.companies !== undefined) {
        await db.delete(usersToCompanies).where(eq(usersToCompanies.userId, input.id));

        const relationValues = input.data.companies.map((c) => ({
          userId: input.id,
          companyId: c,
        }));

        if (relationValues.length) {
          await db.insert(usersToCompanies).values(relationValues);
        }
      }

      if (input.data.pageRoles !== undefined) {
        await db.delete(usersToPageRoles).where(eq(usersToPageRoles.userId, input.id));

        if (input.data.pageRoles.length > 0) {
          const pageRoleValues = input.data.pageRoles.map((roleId) => ({
            userId: input.id,
            pageRoleId: roleId,
          }));
          await db.insert(usersToPageRoles).values(pageRoleValues);
        }
      }

      logEvent({
        resourceType: 'kullanıcı',
        resourceId: String(input.id),
        action: 'güncellendi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return {
        message: 'Kullanıcı güncellendi.',
        updatedOn: editedUsers[0].updatedOn!,
      };
    }),

  deleteUser: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
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

      logEvent({
        resourceType: 'kullanıcı',
        resourceId: String(input.id),
        action: 'silindi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Kullanıcı silindi.' };
    }),

  deleteUsers: authorizedProcedure
    .input(z.object({ ids: z.array(z.number().int().positive()) }))
    .mutation(async ({ input, ctx }) => {
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

      logEvent(
        [...existingIds].map((id) => ({
          resourceType: 'kullanıcı',
          resourceId: String(id),
          action: 'silindi',
          actorId: Number(ctx.user.id),
          status: 'başarılı' as const,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'] ?? null,
        })),
      );
      return {
        message:
          result.rowCount !== ids.length
            ? 'Bazı kullanıcılar silindi, bazıları bulunamadı.'
            : 'Silme operasyonu hatasız geçti',
        deletedRows: result.rowCount,
        results,
      };
    }),
});
