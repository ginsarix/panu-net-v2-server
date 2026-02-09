import { TRPCError } from '@trpc/server';
import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import { pageRoleProtectedProcedure, router } from '../index.js';
import axios from 'axios';
import { constructGetOrders, sourceWithScf } from '../../utils/web-service.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import type { WsGetOrdersResponse } from '../../types/web-service.js';

export const orderRouter = router({
  getOrders: pageRoleProtectedProcedure('ORDERS_VIEW').query(async ({ ctx }) => {
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

      const wsSessionId = ctx.req.session.get('wsSessionId');
      const selectedPeriodCode = ctx.req.session.get('selectedPeriodCode');

      const ordersResponse = await axios.post<WsGetOrdersResponse>(
        sourceWithScf(result.webServiceSource),
        constructGetOrders(wsSessionId!, result.code, selectedPeriodCode, {
          selectedcolumns: [
            'fisno',
            'unvan',
            'kartaciklama',
            'miktar',
            'anabirimi',
            'birimfiyatidovizi',
            'toplamtutar',
            'tutari',
            'turuack',
            'turu',
            'onay',
            'note',
            'tamamisevkedildi',
            '_cdate',
          ],
        }),
      );

      // Emit credit count change event after web service calls
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getOrders');
      }

      return { orders: ordersResponse.data };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      ctx.req.log.error(error, 'Failed to get orders');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Siparişler getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
