import { TRPCError } from '@trpc/server';
import chalk from 'chalk';
import { z } from 'zod';

import { protectedProcedure, router } from '..';
import { unexpectedErrorMessage } from '../../constants/messages';
import myAxios from '../../services/api-base';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';
import type { WsGetInvoiceListResponse, WsGetWaybillListResponse } from '../../types/web-service';
import {
  constructGetInvoices,
  constructGetWaybill,
  createdAtTodayFilters,
  dateRangeFilters,
  sourceWithScf,
} from '../../utils/web-service';

export const reportRouter = router({
  getGeneralReport: protectedProcedure
    .input(z.object({ startDate: z.date().nullish(), endDate: z.date().nullish() }))
    .query(async ({ ctx, input }) => {
      try {
        await login(ctx.req);

        const [message, code, result] = await getCompanyById(ctx.req.session.selectedCompanyId!);

        if (!result) {
          throw new TRPCError({
            code: code || 'INTERNAL_SERVER_ERROR',
            message: message || unexpectedErrorMessage,
          });
        }

        const filters = !(input.startDate && input.endDate)
          ? createdAtTodayFilters()
          : dateRangeFilters(input.startDate, input.endDate);

        const waybillsResponsePromise = myAxios.post<WsGetWaybillListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetWaybill(
            ctx.req.session.wsSessionId!,
            result.code,
            ctx.req.session.selectedPeriodCode,
            {
              selectedcolumns: [
                'aciklama',
                'belgeno2',
                'turuack',
                'fisno',
                'cariunvan',
                'doviz',
                'birim',
                'miktar',
                'stokaciklama',
                'stokkartkodu',
                'tutari',
                'kdvtutari',
                'indirimtutari',
                'toplamtutar',
              ],
            },
            filters,
          ),
        );

        const invoicesResponsePromise = myAxios.post<WsGetInvoiceListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetInvoices(
            ctx.req.session.wsSessionId!,
            result.code,
            ctx.req.session.selectedPeriodCode,
            {
              selectedcolumns: [
                'kartaciklama',
                'kartkodu',
                'belgeno2',
                'turuack',
                'fisno',
                'miktar',
                'fatbirimi',
                'kalemdovizi',
                'unvan',
                'kdvharictutar',
                'kdvtutari',
                'indirimtutari',
                'toplamtutar',
              ],
            },
            filters,
          ),
        );

        const [waybillsResponse, invoicesResponse] = await Promise.all([
          waybillsResponsePromise,
          invoicesResponsePromise,
        ]);

        console.info(
          chalk.inverse(
            chalk.blueBright('General report requests: '),
            waybillsResponse.config.data,
            invoicesResponse.config.data,
          ),
        );

        return {
          waybills: waybillsResponse.data,
          invoices: invoicesResponse.data,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('An error occurred while getting general report: ', error);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Genel raporu getirirken bir hata ile karşılaşıldı.',
        });
      }
    }),
});
