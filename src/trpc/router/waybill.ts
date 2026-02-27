import { TRPCError } from '@trpc/server';
import { pageRoleProtectedProcedure, router } from '../index.js';
import { login } from '../../services/web-service/sis.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import type { WsGetWaybillListResponse } from '../../types/web-service.js';
import { sourceWithScf, constructGetWaybill, isActiveFilter } from '../../utils/web-service.js';
import myAxios from '../../services/api-base.js';

export const waybillRouter = router({
  getWaybills: pageRoleProtectedProcedure('WAYBILL_VIEW').query(async ({ ctx }) => {
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

      const waybillsResponse = await myAxios.post<WsGetWaybillListResponse>(
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
              'turu',
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
              '__fatura',
            ],
          },
          [isActiveFilter],
        ),
      );

      return { waybills: waybillsResponse.data };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      ctx.req.log.error(error, 'An error occurred while getting waybills');

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'İrsaliyeleri getirirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
