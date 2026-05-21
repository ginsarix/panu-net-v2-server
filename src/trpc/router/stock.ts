import { TRPCError } from '@trpc/server';
import { pageRoleProtectedProcedure, router } from '../index.js';
import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import {
  constructGetServices,
  constructGetStockMovements,
  constructGetStocks,
  handleErrorCodes,
  isActiveFilter,
  sourceWithScf,
} from '../../utils/web-service.js';
import type {
  WsGetServicesResponse,
  WsGetStocksResponse,
  WsGetStockMovementsResponse,
} from '../../types/web-service.js';
import myAxios from '../../services/api-base.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { z } from 'zod';

export const stockRouter = router({
  getStocks: pageRoleProtectedProcedure('STOCKS_VIEW').query(async ({ ctx }) => {
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
          selectedcolumns: [
            '_key',
            'stokkartkodu',
            'aciklama',
            'stokkartturu',
            'fiili_stok',
            'birimadi',
          ],
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
  }),

  getStockMovements: pageRoleProtectedProcedure('STOCKS_VIEW')
    .input(
      z.object({
        stockKey: z.string().min(1, 'Stok anahtarı boş olamaz'),
      }),
    )
    .query(async ({ ctx, input }) => {
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

      const stockMovementsResponse = await myAxios.post<WsGetStockMovementsResponse>(
        sourceWithScf(result.webServiceSource),
        constructGetStockMovements(
          wsSessionId,
          result.code,
          selectedPeriodCode,
          {
            selectedcolumns: ['fisno', 'aciklama', 'tutari', '_cdate'],
            _key: input.stockKey,
          },
          [isActiveFilter],
        ),
      );

      const responseMsg = stockMovementsResponse.data.msg;

      handleErrorCodes(stockMovementsResponse.data.code, {
        notFound: responseMsg,
        badRequest: responseMsg,
        internalServerError: responseMsg,
      });

      // Emit credit count change event after web service call
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getStockMovements');
      }

      return stockMovementsResponse.data;
    }),

  getServices: pageRoleProtectedProcedure('SERVICES_VIEW').query(async ({ ctx }) => {
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
  }),
});
