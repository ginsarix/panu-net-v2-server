import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { getWsCreditCount, login } from '../../services/web-service/sis.js';
import { pageRoleProtectedProcedure, protectedProcedure, router } from '../index.js';
import axios from 'axios';
import { constructGetOrders, sourceWithScf } from '../../utils/web-service.js';
import { getCompanyById } from '../../services/companiesDb.js';
import { unexpectedErrorMessage } from '../../constants/messages.js';
import type { WsGetOrdersResponse } from '../../types/web-service.js';
import { db } from '../../db/index.js';
import { users } from '../../db/schema/user.js';
import { usersToCompanies } from '../../db/schema/user-company.js';
import { sendEmail } from '../../utils/send-email.js';

export const orderRouter = router({
  getOrders: pageRoleProtectedProcedure('ORDERS_VIEW').query(async ({ ctx }) => {
    await login(ctx.req);

    const [message, code, result] = await getCompanyById(ctx.req.session.get('selectedCompanyId')!);

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
          'aciklama',
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
          'depo',
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
  }),

  forwardOrdersToUsers: protectedProcedure
    .input(
      z.object({
        orders: z.array(
          z.object({
            fisno: z.string(),
            unvan: z.string(),
            kartaciklama: z.string(),
            miktar: z.string(),
            anabirimi: z.string(),
            birimfiyatidovizi: z.string(),
            toplamtutar: z.string(),
            tutari: z.string(),
            turuack: z.enum(['Verilen Sipariş', 'Alınan Sipariş']),
            turu: z.enum(['1', '2']),
            onay: z.enum(['KABUL', 'TEKLIF', 'ANALIZ', 'RET']),
            note: z.string(),
            tamamisevkedildi: z.enum(['t', 'f']),
            _cdate: z.string(),
          }),
        ),
        userIds: z.array(z.number().int().positive()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { orders, userIds } = input;

      if (!orders.length) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sipariş listesi boş olamaz.' });
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

      const rows = orders
        .map(
          (o) => `
        <tr>
          <td>${o.fisno}</td>
          <td>${o.unvan}</td>
          <td>${o.kartaciklama}</td>
          <td>${o.miktar} ${o.anabirimi}</td>
          <td>${o.birimfiyatidovizi}</td>
          <td>${o.toplamtutar}</td>
          <td>${o.tutari}</td>
          <td>${o.turuack}</td>
          <td>${o.onay}</td>
          <td>${o.tamamisevkedildi === 't' ? 'Evet' : 'Hayır'}</td>
          <td>${o.note}</td>
          <td>${o._cdate}</td>
        </tr>`,
        )
        .join('');

      const html = `
        <html>
          <body style="font-family: Arial, sans-serif; font-size: 13px;">
            <h2>Sipariş Listesi</h2>
            <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
              <thead style="background-color: #f2f2f2;">
                <tr>
                  <th>Fiş No</th>
                  <th>Ünvan</th>
                  <th>Kart Açıklama</th>
                  <th>Miktar</th>
                  <th>Birim Fiyat (Döviz)</th>
                  <th>Toplam Tutar</th>
                  <th>Tutarı</th>
                  <th>Tür</th>
                  <th>Onay</th>
                  <th>Tamamen Sevk Edildi</th>
                  <th>Not</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>`;

      void Promise.all(
        targetUsers.map((user) => sendEmail({ to: user.email, subject: 'Sipariş Listesi', html })),
      );

      return {
        message: `Sipariş listesi ${targetUsers.length} kullanıcıya gönderildi.`,
        sentTo: targetUsers.map((u) => ({ id: u.id, name: u.name, email: u.email })),
      };
    }),
});
