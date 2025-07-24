import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { publicProcedure, router } from '../';
import { scfEndpoint } from '../../constants/endpoints';
import {
  badRequestMessage,
  notFoundMessage,
  selectedCompanyNotFoundMessage,
  serverErrorMessage,
  unexpectedErrorMessage,
} from '../../constants/messages';
import myAxios from '../../services/api-base.ts';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';
import { WsScfListResponse } from '../../types/web-service.ts';
import { parseIntBase10 } from '../../utils/parsing';
import { sourceWithSlash } from '../../utils/web-service';

const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;

export const creditorRouter = router({
  getCreditors: publicProcedure
    .input(
      z.object({
        companyCode: z.string(),
        periodCode: z.union([z.string(), z.number()]),
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

        const creditorsParams = {
          scf_carikart_listele: {
            session_id: ctx.req.session.wsSessionId,
            firma_kodu: Number(input.companyCode),
            donem_kodu:
              typeof input.periodCode === 'string' ? Number(input.periodCode) : input.periodCode,
            filters: [{ field: 'ba', operator: '=', value: '(A)' }],
            params: {
              selectedcolumns: ['carikartkodu', 'unvan', 'dovizturu', 'bakiye'],
            },
          },
        };

        console.log(creditorsParams);

        const scfResponse = await myAxios.post<WsScfListResponse>(
          sourceWithScf(result.webServiceSource),
          creditorsParams,
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
