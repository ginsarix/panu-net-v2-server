import { TRPCError } from '@trpc/server';

import { unexpectedErrorMessage } from '../../constants/messages.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import {
  getAccountCards,
  handleErrorCodes,
  isActiveFilter,
  sourceWithScf,
} from '../../utils/web-service.js';
import { pageRoleProtectedProcedure, router } from '../index.js';

export const creditorRouter = router({
  getCreditors: pageRoleProtectedProcedure('CREDITOR_VIEW').query(async ({ ctx }) => {
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
        [isActiveFilter],
      );

      const responseMsg = creditors.data.msg;

      handleErrorCodes(creditors.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      // Emit credit count change event after web service call
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getCreditors');
      }

      return {
        message: responseMsg,
        payload: creditors.data,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      ctx.req.log.error(error, 'Failed to get creditors');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Alacaklı cariler getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
