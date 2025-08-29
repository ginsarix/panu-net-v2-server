import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { scfEndpoint } from '../../constants/endpoints.js';
import {
  badRequestMessage,
  notFoundMessage,
  selectedCompanyNotFoundMessage,
  serverErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages.js';
import myAxios from '../../services/api-base.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { login } from '../../services/web-service/sis.js';
import type { WsAccountCardListResponse } from '../../types/web-service';
import { parseIntBase10 } from '../../utils/parsing.js';
import { constructGetAccountCards, sourceWithSlash } from '../../utils/web-service.js';
import { protectedProcedure, router } from '../index.js';

const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;

export const creditorRouter = router({
  getCreditors: protectedProcedure
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
            [{ field: 'ba', operator: '=', value: '(A)' }],
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
          message: scfResponse.data.msg,
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
