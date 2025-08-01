import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { publicProcedure, router } from '../';
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
import { WsScfListResponse } from '../../types/web-service.ts';
import { parseIntBase10 } from '../../utils/parsing.ts';
import { sourceWithSlash } from '../../utils/web-service.ts';

const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;

export const debtorRouter = router({
  getDebtors: publicProcedure
    .input(
      z.object({
        companyCode: z.number().int().positive(),
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

        const debtorsParams = {
          scf_carikart_listele: {
            session_id: ctx.req.session.wsSessionId,
            firma_kodu: input.companyCode,
            donem_kodu: ctx.req.session.selectedPeriodCode ?? 0,
            filters: [{ field: 'ba', operator: '=', value: '(B)' }],
            params: {
              selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
            },
          },
        };

        console.log(debtorsParams);

        const scfResponse = await myAxios.post<WsScfListResponse>(
          sourceWithScf(result.webServiceSource),
          debtorsParams,
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
