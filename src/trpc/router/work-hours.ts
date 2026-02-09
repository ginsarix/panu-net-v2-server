import { TRPCError } from '@trpc/server';
import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import { pageRoleProtectedProcedure, router } from '../index.js';
import axios from 'axios';
import { constructGetEmployeeTally, sourceWithPer } from '../../utils/web-service.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import type { WsGetEmployeeTallyResponse } from '../../types/web-service.js';

export const workHoursRouter = router({
  getWorkHours: pageRoleProtectedProcedure('WORK_HOURS_VIEW').query(async ({ ctx }) => {
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

      const employeeTalliesResponse = await axios.post<WsGetEmployeeTallyResponse>(
        sourceWithPer(result.webServiceSource),
        constructGetEmployeeTally(wsSessionId!, result.code, selectedPeriodCode, {
          selectedcolumns: [
            'personeladisoyadi',
            'personelsicilno',
            'normalmesaisaat',
            'toplamfazlamesaisaat',
            'gecemesaisisaat',
            'haftasonumesaisisaat',
            '_cdate',
          ],
        }),
      );

      // Emit credit count change event after web service calls
      try {
        await getWsCreditCount(ctx.req);
      } catch (error) {
        // Log but don't fail if credit count fetch fails
        ctx.req.log.error(error, 'Failed to fetch credit count after getWorkHours');
      }

      return { employeeTallies: employeeTalliesResponse.data };
    } catch (error) {
      if (error instanceof TRPCError) throw error;

      ctx.req.log.error(error, 'Failed to get work hours');
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Mesai saatleri getirilirken bir hata ile karşılaşıldı.',
      });
    }
  }),
});
