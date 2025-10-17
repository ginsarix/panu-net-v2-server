import { TRPCError } from '@trpc/server';

import { unexpectedErrorMessage } from '../../constants/messages';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';
import { getAccountCards, handleErrorCodes, sourceWithScf } from '../../utils/web-service';
import { protectedProcedure, router } from '../index';

export const debtorRouter = router({
  getDebtors: protectedProcedure.query(async ({ ctx }) => {
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

      const debtors = await getAccountCards(
        sourceWithScf(result.webServiceSource),
        ctx.req.session.get('wsSessionId')!,
        result.code,
        ctx.req.session.get('selectedPeriodCode'),
        '(B)',
        {
          selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
        },
      );

      const responseMsg = debtors.data.msg;

      handleErrorCodes(debtors.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      return {
        message: responseMsg,
        payload: debtors.data,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      console.error('Failed to get debtors: ', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Borçlu cariler getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
