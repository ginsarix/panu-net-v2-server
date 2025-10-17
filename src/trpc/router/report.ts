import { TRPCError } from '@trpc/server';
import chalk from 'chalk';
import { z } from 'zod';

import { protectedProcedure, router } from '..';
import { unexpectedErrorMessage } from '../../constants/messages';
import myAxios from '../../services/api-base';
import { getCompanyById } from '../../services/companiesDb';
import { login } from '../../services/web-service/sis';
import type {
  WsGetBankReceiptListResponse,
  WsGetCashAccountListResponse,
  WsGetCashCollectionListResponse,
  WsGetInvoiceListResponse,
  WsGetMaterialReceiptListResponse,
  WsGetWaybillListResponse,
} from '../../types/web-service';
import {
  constructGetBankReceipts,
  constructGetCashAccounts,
  constructGetCreditCardCollections,
  constructGetInvoices,
  constructGetMaterialReceipts,
  constructGetWaybill,
  createdAtTodayFilters,
  dateRangeFilters,
  getAccountCards,
  sourceWithBcs,
  sourceWithScf,
} from '../../utils/web-service';

export const reportRouter = router({
  getGeneralReport: protectedProcedure
    .input(z.object({ startDate: z.date().nullish(), endDate: z.date().nullish() }))
    .query(async ({ ctx, input }) => {
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

        const filters = !(input.startDate && input.endDate)
          ? createdAtTodayFilters()
          : dateRangeFilters(input.startDate, input.endDate);

        const wsSessionId = ctx.req.session.get('wsSessionId');
        const selectedPeriodCode = ctx.req.session.get('selectedPeriodCode');

        const waybillsResponsePromise = myAxios.post<WsGetWaybillListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetWaybill(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
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
                '_cdate',
              ],
            },
            filters,
          ),
        );

        const invoicesResponsePromise = myAxios.post<WsGetInvoiceListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetInvoices(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
            {
              selectedcolumns: [
                'kartaciklama',
                'kartkodu',
                'belgeno2',
                'turuack',
                'turu',
                'fisno',
                'miktar',
                'fatbirimi',
                'kalemdovizi',
                'unvan',
                'kdvharictutar',
                'kdvtutari',
                'indirimtutari',
                'toplamtutar',
                '_cdate',
              ],
            },
            filters,
          ),
        );

        const cashAccountsResponsePromise = myAxios.post<WsGetCashAccountListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetCashAccounts(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
            {
              selectedcolumns: ['ba', 'alacak', 'borc', 'bakiye', '_cdate'],
            },
            filters,
          ),
        );

        const bankReceiptsResponsePromise = myAxios.post<WsGetBankReceiptListResponse>(
          sourceWithBcs(result.webServiceSource),
          constructGetBankReceipts(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
            {
              selectedcolumns: ['fisno', 'borc', 'turuack', 'aciklama', '_cdate'],
            },
            [...filters, { field: 'borc', operator: '!', value: '0' }],
          ),
        );

        const creditCardCollectionsResponsePromise = myAxios.post<WsGetCashCollectionListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetCreditCardCollections(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
            {
              selectedcolumns: [
                'cariunvan',
                'dovizturu',
                'toplamtutar',
                'bankahesapadi',
                'aciklama',
                'devirfisno',
                '_cdate',
              ],
            },
            filters,
          ),
        );

        const accountCardsResponsePromise = getAccountCards(
          sourceWithScf(result.webServiceSource),
          wsSessionId!,
          result.code,
          selectedPeriodCode,
          undefined,
          {
            selectedcolumns: ['bakiye', 'ba'],
          },
          filters,
        );

        const materialReceiptsResponsePromise = myAxios.post<WsGetMaterialReceiptListResponse>(
          sourceWithScf(result.webServiceSource),
          constructGetMaterialReceipts(
            wsSessionId!,
            result.code,
            selectedPeriodCode,
            {
              selectedcolumns: [
                'fisno',
                'cariunvan',
                'aciklama',
                'turuack',
                '_cdate',
                'toplam',
                'stokkodu',
                'stokadi',
                'doviz',
                'birim',
                'miktar',
              ],
            },
            [...filters, { field: 'turu', operator: 'IN', value: '1,3,8,9' }],
          ),
        );

        const responses = await Promise.all([
          waybillsResponsePromise,
          invoicesResponsePromise,
          cashAccountsResponsePromise,
          bankReceiptsResponsePromise,
          creditCardCollectionsResponsePromise,
          accountCardsResponsePromise,
          materialReceiptsResponsePromise,
        ]);

        const [
          waybillsResponse,
          invoicesResponse,
          cashAccountsResponse,
          bankReceiptsResponse,
          creditCardCollectionsResponse,
          accountCardsResponse,
          materialReceiptsResponse,
        ] = responses;

        console.info(
          chalk.inverse(
            chalk.blueBright('General report requests: '),
            ...responses.map((r) => r.config.data as unknown),
          ),
        );

        const cashAccountsBalanceSum = cashAccountsResponse.data.result
          .map((ca) => Number(ca.bakiye))
          .reduce((acc, val) => acc + val, 0);

        const accountCardsCreditorSum = accountCardsResponse.data.result
          .map((ac) => (ac.ba === '(A)' ? Number(ac.bakiye) : 0))
          .reduce((acc, val) => acc + val, 0);

        const accountCardsDebtorSum = accountCardsResponse.data.result
          .map((ac) => (ac.ba === '(B)' ? Number(ac.bakiye) : 0))
          .reduce((acc, val) => acc + val, 0);

        const purchasedServicesInvoicesSum = invoicesResponse.data.result
          .filter((i) => i.turu === '4')
          .map((i) => Number(i.toplamtutar))
          .reduce((acc, val) => acc + val, 0);

        return {
          waybills: waybillsResponse.data,
          invoices: invoicesResponse.data,
          cashAccountsBalanceSum,
          bankReceipts: bankReceiptsResponse.data,
          creditCardCollections: creditCardCollectionsResponse.data,
          accountCards: accountCardsResponse.data,
          accountCardsCreditorSum,
          accountCardsDebtorSum,
          purchasedServicesInvoicesSum,
          materialReceipts: materialReceiptsResponse.data,
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
