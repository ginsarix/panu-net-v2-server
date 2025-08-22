import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { protectedProcedure, router } from '../';
import { scfEndpoint } from '../../constants/endpoints.ts';
import {
  badRequestMessage,
  notFoundMessage,
  selectedCompanyNotFoundMessage,
  serverErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.ts';
import myAxios from '../../services/api-base.ts';
import { getCompanyById } from '../../services/companiesDb.ts';
import { login } from '../../services/web-service/sis.ts';
import { WsAccountCardListResponse } from '../../types/web-service.ts';
import { parseIntBase10 } from '../../utils/parsing.ts';
import { constructGetAccountCards, sourceWithSlash } from '../../utils/web-service.ts';

const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;

export const debtorRouter = router({
  getDebtors: protectedProcedure
    .input(
      z.object({
        companyCode: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
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

        const scfResponse = await myAxios.post<WsAccountCardListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetAccountCards(
            ctx.req.session.wsSessionId!,
            input.companyCode,
            ctx.req.session.selectedPeriodCode,
            {
              selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
            },
            [{ field: 'ba', operator: '=', value: '(B)' }],
          ),
        );

        const responseCode = parseIntBase10(scfResponse.data.code || '500');

        if (responseCode >= 400) {
          if (responseCode === 404) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: scfResponse?.data.msg || notFoundMessage,
            });
          } else if (responseCode >= 400 && responseCode < 500) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: scfResponse?.data.msg || badRequestMessage,
            });
          } else {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: scfResponse?.data.msg || serverErrorMessage,
            });
          }
        }

        return {
          message: scfResponse?.data.msg,
          payload: scfResponse?.data,
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
