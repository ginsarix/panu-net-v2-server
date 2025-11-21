import { TRPCError } from '@trpc/server';
import { pageRoleProtectedProcedure, router } from '../index.js';
import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import {
  constructGetServices,
  constructGetStocks,
  handleErrorCodes,
  isActiveFilter,
  sourceWithScf,
} from '../../utils/web-service.js';
import type { WsGetServicesResponse, WsGetStocksResponse } from '../../types/web-service.js';
import myAxios from '../../services/api-base.js';
import { getCompanyById } from '../../services/companiesDb.js';

export const stockRouter = router({
  getStocks: pageRoleProtectedProcedure('STOCKS_VIEW').query(async ({ ctx }) => {
    try {
      await login(ctx.req);
      const selectedCompanyId = ctx.req.session.get('selectedCompanyId');
      const [message, code, result] = await getCompanyById(selectedCompanyId!);
      if (!result) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message || unexpectedErrorMessage,
        });
      }
      const wsSessionId = ctx.req.session.get('wsSessionId')!;

      const selectedPeriodCode = ctx.req.session.get('selectedPeriodCode');

      const stocksResponse = await myAxios.post<WsGetStocksResponse>(
        sourceWithScf(result.webServiceSource),
        constructGetStocks(
          wsSessionId,
          result.code,
          selectedPeriodCode,
          {
            selectedcolumns: ['stokkartkodu', 'aciklama', 'stokkartturu', 'fiili_stok', 'birimadi'],
          },
          [isActiveFilter],
        ),
      );

      const responseMsg = stocksResponse.data.msg;

      handleErrorCodes(stocksResponse.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      // Emit credit count change event after web service call
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getStocks');
      }

      return {
        message: responseMsg,
        payload: stocksResponse.data,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to get stocks');
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Stoklar alınamadı.' });
    }
  }),

  getServices: pageRoleProtectedProcedure('SERVICES_VIEW').query(async ({ ctx }) => {
    try {
      await login(ctx.req);
      const selectedCompanyId = ctx.req.session.get('selectedCompanyId');
      const [message, code, result] = await getCompanyById(selectedCompanyId!);
      if (!result) {
        throw new TRPCError({
          code: code || 'INTERNAL_SERVER_ERROR',
          message: message || unexpectedErrorMessage,
        });
      }
      const wsSessionId = ctx.req.session.get('wsSessionId')!;

      const selectedPeriodCode = ctx.req.session.get('selectedPeriodCode');

      const servicesResponse = await myAxios.post<WsGetServicesResponse>(
        sourceWithScf(result.webServiceSource),
        constructGetServices(
          wsSessionId,
          result.code,
          selectedPeriodCode,
          {
            selectedcolumns: [
              'hizmetkartkodu',
              'aciklama',
              'hizmetkartturuack',
              'miktar',
              'birimadi',
            ],
          },
          [isActiveFilter],
        ),
      );

      const responseMsg = servicesResponse.data.msg;

      handleErrorCodes(servicesResponse.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      // Emit credit count change event after web service call
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getServices');
      }

      return {
        message: responseMsg,
        payload: servicesResponse.data,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      ctx.req.log.error(error, 'Failed to get services');
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Hizmetler alınamadı.' });
    }
  }),
});
