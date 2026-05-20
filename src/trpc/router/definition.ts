import z from 'zod';
import { definitions } from '../../db/schema/definitions.js';
import { authorizedProcedure, protectedProcedure, router } from '../index.js';
import { logEvent } from '../../utils/event-log.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { TRPCError } from '@trpc/server';
import { definitionNotFoundMessage } from '../../constants/messages.js';
import {
  CreateDefinitionSchema,
  UpdateDefinitionSchema,
} from '../../services/zod-validations/definition.js';
import { currentDefinition } from '../../db/schema/current-definition.js';

export const definitionRouter = router({
  getDefinitions: authorizedProcedure.query(async () => {
    const allDefinitions = await db
      .select({ id: definitions.id, name: definitions.name })
      .from(definitions);

    return { definitions: allDefinitions, message: 'Tanımlar başarıyla getirildi.' };
  }),

  getDefinition: authorizedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      }),
    )
    .query(async ({ input }) => {
      const [definition] = await db
        .select()
        .from(definitions)
        .where(eq(definitions.id, input.id));
      if (!definition) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: definitionNotFoundMessage,
        });
      }
      return { definition, message: 'Tanım başarıyla getirildi.' };
    }),

  createDefinition: authorizedProcedure
    .input(CreateDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const definition = await db
        .insert(definitions)
        .values(input)
        .returning({ id: definitions.id });
      logEvent({
        resourceType: 'tanım',
        resourceId: String(definition[0].id),
        action: 'oluşturuldu',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { definition, message: 'Tanım başarıyla oluşturuldu.' };
    }),

  updateDefinition: authorizedProcedure
    .input(UpdateDefinitionSchema)
    .mutation(async ({ input, ctx }) => {
      const [definition] = await db
        .update(definitions)
        .set(input)
        .where(eq(definitions.id, input.id))
        .returning({ updatedOn: definitions.updatedAt });

      if (!definition) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: definitionNotFoundMessage,
        });
      }

      logEvent({
        resourceType: 'tanım',
        resourceId: String(input.id),
        action: 'güncellendi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { definition, message: 'Tanım başarıyla güncellendi.' };
    }),

  deleteDefinition: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const definitionsCount = await db.$count(definitions);

      if (definitionsCount === 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Son tanım silinemez.',
        });
      }

      const definition = await db.delete(definitions).where(eq(definitions.id, input.id));

      if (!definition.rowCount) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: definitionNotFoundMessage,
        });
      }
      logEvent({
        resourceType: 'tanım',
        resourceId: String(input.id),
        action: 'silindi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Tanım başarıyla silindi.' };
    }),

  setCurrentDefinition: authorizedProcedure
    .input(z.object({ definitionId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      // Upsert FTW!!
      await db
        .insert(currentDefinition)
        .values({ id: 1, definitionId: input.definitionId })
        .onConflictDoUpdate({
          target: currentDefinition.id,
          set: { definitionId: input.definitionId },
        });

      logEvent({
        resourceType: 'tanım',
        resourceId: String(input.definitionId),
        action: 'aktif tanım değiştirildi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return { message: 'Tanım başarıyla seçildi.' };
    }),

  getCurrentDefinition: protectedProcedure.query(async () => {
    const [currentDefinitionRecord] = await db
      .select({ definitionId: currentDefinition.definitionId })
      .from(currentDefinition)
      .limit(1);

    if (!currentDefinitionRecord) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Seçili tanım bulunamadı.',
      });
    }

    const [definition] = await db
      .select()
      .from(definitions)
      .where(eq(definitions.id, currentDefinitionRecord.definitionId));

    return { definition, message: 'Seçili tanım başarıyla getirildi.' };
  }),
});
