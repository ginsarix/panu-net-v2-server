import { TRPCError } from '@trpc/server';

import { unexpectedErrorMessage } from '../../constants/messages';
import myAxios from '../../services/api-base';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';
import type { WsAccountCardListResponse } from '../../types/web-service';
import { constructGetAccountCards, handleErrorCodes, sourceWithScf } from '../../utils/web-service';
import { protectedProcedure, router } from '../index';

export const creditorRouter = router({
  getCreditors: protectedProcedure.query(async ({ ctx }) => {
    try {
      await login(ctx.req);

      const [message, code, result] = await getCompanyById(ctx.req.session.selectedCompanyId!);

      if (!result) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message || unexpectedErrorMessage,
        });
      }

      const scfResponse = await myAxios.post<WsAccountCardListResponse>(
        sourceWithScf(result.webServiceSource),
        constructGetAccountCards(
          ctx.req.session.wsSessionId!,
          result.code,
          ctx.req.session.selectedPeriodCode,
          {
            selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
          },
          [{ field: 'ba', operator: '=', value: '(A)' }],
        ),
      );

      const responseMsg = scfResponse.data.msg;

      handleErrorCodes(scfResponse.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      return {
        message: responseMsg,
        payload: scfResponse.data,
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
