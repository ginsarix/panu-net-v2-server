import { TRPCError } from '@trpc/server';
import z from 'zod';

import { protectedProcedure, router } from '..';
import { selectedCompanyNotFoundMessage, unexpectedErrorMessage } from '../../constants/messages';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';

export const stockRouter = router({
  getStock: protectedProcedure
    .input(
      z.object({
        companyCode: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        await login(ctx.req);

        if (!ctx.req.session.selectedCompanyId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: selectedCompanyNotFoundMessage,
          });
        }

        const [message, code, result] = await getCompanyById(ctx.req.session.selectedCompanyId);

        if (!result) {
          throw new TRPCError({
            code: code || 'INTERNAL_SERVER_ERROR',
            message: message || unexpectedErrorMessage,
          });
        }
      } catch (error) {
        console.error(error);
      }
    }),
});
