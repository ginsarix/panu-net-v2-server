import { authorizedProcedure, protectedProcedure, router } from '../index.js';
import {
  ContractCreateSchema,
  ContractEditSchema,
} from '../../services/zod-validations/contract.js';
import { TRPCError } from '@trpc/server';
import { db } from '../../db/index.js';
import { contracts } from '../../db/schema/contracts.js';
import { eq, desc, or } from 'drizzle-orm';
import { z } from 'zod';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileHashes } from '../../db/schema/fileHashes.js';

export const contractRouter = router({
  createContract: authorizedProcedure
    .input(ContractCreateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const [createdContract] = await db
          .insert(contracts)
          .values({
            title: input.title ?? input.fileName,
            fileName: input.fileName,
            companyId: input.company,
          })
          .returning();

        return { message: 'Sözleşme başarıyla oluşturuldu.', createdContract };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to create contract');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Sözleşme oluşturulurken bir hata ile karşılaşıldı.',
        });
      }
    }),

  editContract: authorizedProcedure.input(ContractEditSchema).mutation(async ({ ctx, input }) => {
    try {
      const [updatedContract] = await db
        .update(contracts)
        .set({
          title: input.title ?? input.fileName,
          companyId: input.company,
        })
        .where(eq(contracts.id, input.id))
        .returning();

      return { message: 'Sözleşme başarıyla güncellendi.', updatedContract };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to edit contract');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Sözleşme güncellenirken bir hata ile karşılaşıldı.',
      });
    }
  }),
  deleteContract: authorizedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [contract] = await db.select().from(contracts).where(eq(contracts.id, input.id));

        if (!contract) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Sözleşme bulunamadı.',
          });
        }

        const filesDir = path.join(process.cwd(), 'files');
        const contractFileName = contract.fileName;
        const contractThumbnailFileName = contract.fileName.replace('.pdf', '.png');

        void unlink(path.join(filesDir, contractFileName));
        void unlink(path.join(filesDir, 'thumbnails', contractThumbnailFileName));

        await db.delete(contracts).where(eq(contracts.id, input.id));
        await db
          .delete(fileHashes)
          .where(
            or(
              eq(fileHashes.name, contractFileName),
              eq(fileHashes.name, contractThumbnailFileName),
            ),
          );
        return { message: 'Sözleşme başarıyla silindi.' };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        ctx.req.log.error(error, 'Failed to delete contract');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Sözleşme silinirken bir hata ile karşılaşıldı.',
        });
      }
    }),

  getContracts: protectedProcedure.query(async ({ ctx }) => {
    try {
      const isAdmin = ctx.user.role === 'admin';

      const companyId = isAdmin ? undefined : ctx.req.session.get('selectedCompanyId');
      if (!companyId && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Şirket seçilmeden sözleşmeler alınamaz.',
        });
      }

      const base = db.select().from(contracts).orderBy(desc(contracts.createdAt));
      const query = isAdmin ? base : base.where(eq(contracts.companyId, companyId!));

      const queriedContracts = await query;

      return { message: 'Sözleşmeler başarıyla getirildi.', payload: queriedContracts };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to get contracts');
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Sözleşmeler alınamadı.' });
    }
  }),
});
