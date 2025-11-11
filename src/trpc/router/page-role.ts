import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { userNotFoundMessage } from '../../constants/messages.js';
import { db } from '../../db/index.js';
import { pageRoles } from '../../db/schema/page-role.js';
import { usersToPageRoles } from '../../db/schema/user-page-role.js';
import { users } from '../../db/schema/user.js';
import { getAllPageRoles } from '../../services/page-roles.js';
import { authorizedProcedure, protectedProcedure, router } from '../index.js';

export const pageRoleRouter = router({
  getAllPageRoles: protectedProcedure.query(async ({ ctx }) => {
    try {
      const roles = await getAllPageRoles();
      return { pageRoles: roles };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to fetch page roles');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Sayfa rolleri getirilemedi.',
      });
    }
  }),

  getUserPageRoles: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      try {
        const currentUserId = Number(ctx.user.id);
        const isAdmin = ctx.user.role === 'admin';

        // Users can only view their own roles, admins can view any user's roles
        if (!isAdmin && currentUserId !== input.userId) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Başka kullanıcıların sayfa rollerini görüntüleme yetkiniz yoktur.',
          });
        }

        const [user] = await db.select().from(users).where(eq(users.id, input.userId));

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        const userPageRoles = await db
          .select({
            pageRoleId: usersToPageRoles.pageRoleId,
          })
          .from(usersToPageRoles)
          .where(eq(usersToPageRoles.userId, input.userId));

        const roleIds = userPageRoles.map((upr) => upr.pageRoleId);

        if (roleIds.length === 0) {
          return { pageRoleIds: [] };
        }

        const roles = await db.select().from(pageRoles).where(inArray(pageRoles.id, roleIds));

        return { pageRoles: roles, pageRoleIds: roleIds };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to fetch user page roles');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Kullanıcı sayfa rolleri getirilemedi.',
        });
      }
    }),

  assignPageRolesToUser: authorizedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        pageRoleIds: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, pageRoleIds } = input;

        const [user] = await db.select().from(users).where(eq(users.id, userId));

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        // Verify all page role IDs exist
        if (pageRoleIds.length > 0) {
          const existingRoles = await db
            .select()
            .from(pageRoles)
            .where(inArray(pageRoles.id, pageRoleIds));

          if (existingRoles.length !== pageRoleIds.length) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'Bazı sayfa rolleri bulunamadı.',
            });
          }
        }

        // Remove existing assignments
        await db.delete(usersToPageRoles).where(eq(usersToPageRoles.userId, userId));

        // Insert new assignments
        if (pageRoleIds.length > 0) {
          await db.insert(usersToPageRoles).values(
            pageRoleIds.map((roleId) => ({
              userId,
              pageRoleId: roleId,
            })),
          );
        }

        return { message: 'Sayfa rolleri başarıyla atandı.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to assign page roles to user');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Sayfa rolleri atanırken bir hata ile karşılaşıldı.',
        });
      }
    }),

  removePageRolesFromUser: authorizedProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        pageRoleIds: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const { userId, pageRoleIds } = input;

        const [user] = await db.select().from(users).where(eq(users.id, userId));

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: userNotFoundMessage,
          });
        }

        await db
          .delete(usersToPageRoles)
          .where(
            and(
              eq(usersToPageRoles.userId, userId),
              inArray(usersToPageRoles.pageRoleId, pageRoleIds),
            ),
          );

        return { message: 'Sayfa rolleri başarıyla kaldırıldı.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to remove page roles from user');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Sayfa rolleri kaldırılırken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
