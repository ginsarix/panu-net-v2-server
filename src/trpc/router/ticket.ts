import { TRPCError } from '@trpc/server';
import { authorizedProcedure, protectedProcedure, router } from '../index.js';
import { logEvent } from '../../utils/event-log.js';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { tickets } from '../../db/schema/tickets.js';
import { ticketMessages } from '../../db/schema/ticketMessages.js';
import { eq, and, desc, count, SQL, ilike, asc } from 'drizzle-orm';
import { companyIdRequiredMessage } from '../../constants/messages.js';
import { users } from '../../db/schema/user.js';

const paginationInput = z.object({
  page: z.number().int().positive().min(1).default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export const ticketRouter = router({
  openTicket: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, 'Başlık boş olamaz'),
        description: z.string().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = Number(ctx.user.id);
      const companyId = ctx.req.session.get('selectedCompanyId');

      if (!companyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: companyIdRequiredMessage,
        });
      }

      const [createdTicket] = await db
        .insert(tickets)
        .values({ ...input, createdByUserId: userId, belongingCompanyId: companyId })
        .returning();

      logEvent({
        resourceType: 'destek talebi',
        resourceId: String(createdTicket.id),
        action: 'oluşturuldu',
        actorId: userId,
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return {
        createdTicket,
        message: 'Destek talebi başarıyla oluşturuldu',
      };
    }),

  deleteTicket: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await db.delete(tickets).where(eq(tickets.id, input.id));

      logEvent({
        resourceType: 'destek talebi',
        resourceId: String(input.id),
        action: 'silindi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Destek talebi başarıyla silindi' };
    }),

  setTicketState: authorizedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
        state: z.enum(['in_process', 'completed']),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await db
        .update(tickets)
        .set({ ticketState: input.state })
        .where(eq(tickets.id, input.ticketId));

      logEvent({
        resourceType: 'destek talebi',
        resourceId: String(input.ticketId),
        action: 'durum güncellendi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Destek talebi durumu başarıyla değiştirildi' };
    }),

  addTicketMessage: protectedProcedure
    .input(
      z.object({
        ticketId: z.number().int().positive(),
        message: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.req.session.get('selectedCompanyId');

      if (ctx.user.role !== 'admin' && !companyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: companyIdRequiredMessage,
        });
      }

      const [ticket] = await db
        .select()
        .from(tickets)
        .where(
          ctx.user.role !== 'admin'
            ? and(eq(tickets.id, input.ticketId), eq(tickets.belongingCompanyId, companyId!))
            : eq(tickets.id, input.ticketId),
        );

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Destek talebi bulunamadı' });
      }

      const userId = Number(ctx.user.id);

      const [createdTicketMessage] = await db
        .insert(ticketMessages)
        .values({ ...input, authorUserId: userId })
        .returning();

      if (ticket.ticketState === 'completed') {
        await db
          .update(tickets)
          .set({ ticketState: 'reopened' })
          .where(eq(tickets.id, input.ticketId));
      }

      logEvent({
        resourceType: 'destek talebi',
        resourceId: String(input.ticketId),
        action: 'mesaj eklendi',
        actorId: userId,
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return {
        createdTicketMessage,
        message: 'Mesaj başarıyla eklendi',
      };
    }),

  getTickets: protectedProcedure
    .input(
      paginationInput.extend({
        state: z.enum(['open', 'in_process', 'completed', 'reopened']).nullish(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).nullish(),
        search: z.string().nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const companyId = ctx.req.session.get('selectedCompanyId');

      if (ctx.user.role !== 'admin' && !companyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: companyIdRequiredMessage,
        });
      }

      const offset = (input.page - 1) * input.limit;

      const whereConditions: SQL[] = [];

      if (ctx.user.role !== 'admin') {
        // we're already sure companyId is not undef cuz we are checking it for non-admins and this runs only if user is non-admin
        whereConditions.push(eq(tickets.belongingCompanyId, companyId!));
      }

      if (input.priority) whereConditions.push(eq(tickets.priority, input.priority));
      if (input.state) whereConditions.push(eq(tickets.ticketState, input.state));
      if (input.search) whereConditions.push(ilike(tickets.title, `%${input.search}%`));

      const [data, [{ total }]] = await Promise.all([
        db
          .select({
            ticket: tickets,
            user: {
              id: users.id,
              name: users.name,
            },
          })
          .from(tickets)
          .leftJoin(users, eq(users.id, tickets.createdByUserId))
          .where(whereConditions.length ? and(...whereConditions) : undefined)
          .orderBy(desc(tickets.creationDate))
          .limit(input.limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(tickets)
          .where(whereConditions.length ? and(...whereConditions) : undefined),
      ]);

      return {
        data,
        total,
      };
    }),

  getTicketMessages: protectedProcedure
    .input(
      paginationInput.extend({
        ticketId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { ticketId, page, limit } = input;

      const companyId = ctx.req.session.get('selectedCompanyId');

      if (ctx.user.role !== 'admin' && !companyId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: companyIdRequiredMessage,
        });
      }

      const [ticket] = await db
        .select({
          title: tickets.title,
          description: tickets.description,
          status: tickets.ticketState,
        })
        .from(tickets)
        .where(
          ctx.user.role !== 'admin'
            ? and(eq(tickets.id, ticketId), eq(tickets.belongingCompanyId, companyId!))
            : eq(tickets.id, ticketId),
        );

      if (!ticket) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Destek talebi bulunamadı' });
      }

      const offset = (page - 1) * limit;

      const [data, [{ total }]] = await Promise.all([
        db
          .select({
            ticketMessage: ticketMessages,
            user: {
              id: users.id,
              name: users.name,
              role: users.role,
            },
          })
          .from(ticketMessages)
          .leftJoin(users, eq(users.id, ticketMessages.authorUserId))
          .where(eq(ticketMessages.ticketId, ticketId))
          .orderBy(asc(ticketMessages.creationDate))
          .limit(limit)
          .offset(offset),
        db
          .select({ total: count() })
          .from(ticketMessages)
          .where(eq(ticketMessages.ticketId, ticketId)),
      ]);

      return {
        ticket,
        data,
        total,
      };
    }),
});
