import z from 'zod';
import { definitions } from '../../db/schema/definitions.js';
import { authorizedProcedure, protectedProcedure, router } from '../index.js';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { TRPCError } from '@trpc/server';
import { definitionNotFoundMessage, unexpectedErrorMessage } from '../../constants/messages.js';
import {
  CreateDefinitionSchema,
  UpdateDefinitionSchema,
} from '../../services/zod-validations/definition.js';
import { currentDefinition } from '../../db/schema/current-definition.js';

export const definitionRouter = router({
  getDefinitions: authorizedProcedure.query(async ({ ctx }) => {
    try {
      const allDefinitions = await db
        .select({ id: definitions.id, name: definitions.name })
        .from(definitions);

      return { definitions: allDefinitions, message: 'Tanımlar başarıyla getirildi.' };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to get definitions');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: unexpectedErrorMessage,
      });
    }
  }),
  getDefinition: authorizedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
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
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to get definition');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: unexpectedErrorMessage,
        });
      }
    }),
  createDefinition: authorizedProcedure
    .input(CreateDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const definition = await db
          .insert(definitions)
          .values(input)
          .returning({ id: definitions.id });
        return { definition, message: 'Tanım başarıyla oluşturuldu.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to create definition');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: unexpectedErrorMessage,
        });
      }
    }),
  updateDefinition: authorizedProcedure
    .input(UpdateDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
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

        return { definition, message: 'Tanım başarıyla güncellendi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to update definition');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: unexpectedErrorMessage,
        });
      }
    }),
  deleteDefinition: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
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
        return { message: 'Tanım başarıyla silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to delete definition');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: unexpectedErrorMessage,
        });
      }
    }),
  setCurrentDefinition: authorizedProcedure
    .input(z.object({ definitionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Upsert FTW!!
        await db
          .insert(currentDefinition)
          .values({ id: 1, definitionId: input.definitionId })
          .onConflictDoUpdate({
            target: currentDefinition.id,
            set: { definitionId: input.definitionId },
          });

        return { message: 'Tanım başarıyla seçildi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to set current definition');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: unexpectedErrorMessage,
        });
      }
    }),
  getCurrentDefinition: protectedProcedure.query(async ({ ctx }) => {
    try {
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
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to get current definition');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: unexpectedErrorMessage,
      });
    }
  }),
});
