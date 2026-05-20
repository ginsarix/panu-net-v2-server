import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { logEvent } from '../../utils/event-log.js';
import { z } from 'zod';

import { pageRoleProtectedProcedure, protectedProcedure, router } from '../index.js';
import { login } from '../../services/web-service/sis.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import type { WsGetWaybillListResponse } from '../../types/web-service.js';
import { sourceWithScf, constructGetWaybill, isActiveFilter } from '../../utils/web-service.js';
import myAxios from '../../services/api-base.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/user.js';
import { usersToCompanies } from '../../db/schema/user-company.js';
import { sendEmail } from '../../utils/send-email.js';

export const waybillRouter = router({
  getWaybills: pageRoleProtectedProcedure('WAYBILL_VIEW').query(async ({ ctx }) => {
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
  }),

  forwardWaybillsToUsers: protectedProcedure
    .input(
      z.object({
        waybills: z.array(
          z.object({
            turuack: z.string(),
            turu: z.enum(['1', '4', '6', '9', '12', '15', '2', '3', '5', '7', '8', '11', '13']),
            fisno: z.string(),
            belgeno2: z.string(),
            cariunvan: z.string(),
            doviz: z.string(),
            stokaciklama: z.string(),
            stokkartkodu: z.string(),
            tutari: z.string(),
            miktar: z.string(),
            fatbirimi: z.string().optional(),
            kdvtutari: z.string(),
            indirimtutari: z.string(),
            toplamtutar: z.string(),
            _cdate: z.string(),
            __fatura: z.enum(['F', '-']),
          }),
        ),
        userIds: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { waybills, userIds } = input;

      if (!waybills.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'İrsaliye listesi boş olamaz.' });
      }

      if (!userIds.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Kullanıcı listesi boş olamaz.' });
      }

      const selectedCompanyId = ctx.req.session.get('selectedCompanyId');

      if (!selectedCompanyId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seçili firma bulunamadı.' });
      }

      const companyMembers = await db
        .select({ userId: usersToCompanies.userId })
        .from(usersToCompanies)
        .where(
          and(
            eq(usersToCompanies.companyId, selectedCompanyId),
            inArray(usersToCompanies.userId, userIds),
          ),
        );

      const memberIds = new Set(companyMembers.map((m) => m.userId));
      const outsiders = userIds.filter((id) => !memberIds.has(id));

      if (outsiders.length) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Bazı kullanıcılar seçili firmaya ait değil.',
        });
      }

      const targetUsers = await db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds));

      if (!targetUsers.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Kullanıcılar bulunamadı.' });
      }

      const rows = waybills
        .map(
          (w) => `
        <tr>
          <td>${w.fisno}</td>
          <td>${w.belgeno2}</td>
          <td>${w.turuack}</td>
          <td>${w.cariunvan}</td>
          <td>${w.stokkartkodu}</td>
          <td>${w.stokaciklama}</td>
          <td>${w.miktar}${w.fatbirimi ? ` ${w.fatbirimi}` : ''}</td>
          <td>${w.doviz}</td>
          <td>${w.tutari}</td>
          <td>${w.kdvtutari}</td>
          <td>${w.indirimtutari}</td>
          <td>${w.toplamtutar}</td>
          <td>${w.__fatura === 'F' ? 'Evet' : 'Hayır'}</td>
          <td>${w._cdate}</td>
        </tr>`,
        )
        .join('');

      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; font-size: 13px;">
            <h2>İrsaliye Listesi</h2>
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
              <thead style="background-color: #f2f2f2;">
                <tr>
                  <th>Fiş No</th>
                  <th>İrsaliye No</th>
                  <th>Tür</th>
                  <th>Cari Ünvan</th>
                  <th>Stok Kart Kodu</th>
                  <th>Stok Açıklama</th>
                  <th>Miktar</th>
                  <th>Döviz</th>
                  <th>Ara Tutar</th>
                  <th>KDV</th>
                  <th>İndirim</th>
                  <th>Genel Toplam</th>
                  <th>Faturalı</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;

      void Promise.all(
        targetUsers.map((user) =>
          sendEmail({ to: user.email, subject: 'İrsaliye Listesi', html }),
        ),
      );

      logEvent({
        resourceType: 'irsaliye',
        action: 'iletildi',
        actorId: Number(ctx.user.id),
        status: 'başarılı',
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'] ?? null,
      });
      return {
        message: `İrsaliye listesi ${targetUsers.length} kullanıcıya gönderildi.`,
        sentTo: targetUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      };
    }),
});
