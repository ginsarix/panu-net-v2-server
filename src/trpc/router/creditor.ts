import { TRPCError } from '@trpc/server';

import { unexpectedErrorMessage } from '../../constants/messages.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { login } from '../../services/web-service/sis.js';
import { getAccountCards, handleErrorCodes, sourceWithScf } from '../../utils/web-service.js';
import { protectedProcedure, router } from '../index.js';

export const creditorRouter = router({
  getCreditors: protectedProcedure.query(async ({ ctx }) => {
    try {
      await login(ctx.req);

      const [message, code, result] = await getCompanyById(
        ctx.req.session.get('selectedCompanyId')!,
      );

      if (!result) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message || unexpectedErrorMessage,
        });
      }

      const creditors = await getAccountCards(
        sourceWithScf(result.webServiceSource),
        ctx.req.session.get('wsSessionId')!,
        result.code,
        ctx.req.session.get('selectedPeriodCode'),
        '(A)',
        {
          selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
        },
      );

      const responseMsg = creditors.data.msg;

      handleErrorCodes(creditors.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      return {
        message: responseMsg,
        payload: creditors.data,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('Failed to get creditors: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Alacaklı cariler getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
