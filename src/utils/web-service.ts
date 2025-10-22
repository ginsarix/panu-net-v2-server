import { TRPCError } from '@trpc/server';
import { addDays, format } from 'date-fns';

import { bcsEndpoint, scfEndpoint, sisEndpoint } from '../constants/endpoints.js';
import { badRequestMessage, notFoundMessage, serverErrorMessage } from '../constants/messages.js';
import myAxios from '../services/api-base.js';
import type {
  WsAccountCardListResponse,
  WsFilter,
  WsGetAccountCardListRequest,
  WsGetCreditCountRequest,
  WsGetInvoicesRequest,
  WsGetPeriodsRequest,
  WsLoginRequest,
} from '../types/web-service.js';
import { parseIntBase10 } from './parsing.js';

export const constructLogin = (
  username: string,
  password: string,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
  disconnect_same_user: 'true' | 'false' = 'true',
): WsLoginRequest => ({
  login: {
    username,
    password,
    disconnect_same_user,
    params,
    filters,
  },
});

export const constructPing = (sessionId: string) => ({ sis_ping: { session_id: sessionId } });

export const constructGetAccountCards = (
  sessionId: string,
  companyCode: number,
  selectedPeriodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
): WsGetAccountCardListRequest => ({
  scf_carikart_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: selectedPeriodCode,
    params,
    filters,
  },
});

export const constructGetWaybill = (
  sessionId: string,
  companyCode: number,
  selectedPeriodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  scf_irsaliye_listele_ayrintili: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: selectedPeriodCode,
    params,
    filters,
  },
});

export const constructGetInvoices = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
): WsGetInvoicesRequest => ({
  scf_fatura_listele_ayrintili: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetCashAccounts = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  scf_kasakart_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetBankReceipts = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  bcs_banka_fisi_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetCreditCardCollections = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  scf_kk_tahsilat_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetMaterialReceipts = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  scf_malzeme_fisi_listele_ayrintili: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetCheckEntries = (
  sessionId: string,
  companyCode: number,
  periodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => ({
  bcs_ceksenet_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: periodCode,
    params,
    filters,
  },
});

export const constructGetPeriods = (
  sessionId: string,
  companyCode: number,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
): WsGetPeriodsRequest => ({
  sis_firma_getir: {
    session_id: sessionId,
    firma_kodu: companyCode,
    params,
    filters,
  },
});

export const constructGetCreditCount = (
  sessionId: string,
  params?: Record<string, unknown>,
  filters?: WsFilter[],
): WsGetCreditCountRequest => ({
  sis_kontor_sorgula: {
    session_id: sessionId,
    params,
    filters,
  },
});

export const sourceWithSlash = (wsSource: string) => {
  return wsSource.endsWith('/') ? wsSource : wsSource + '/';
};

export const sourceWithSis = (wsSource: string) => sourceWithSlash(wsSource) + sisEndpoint;

export const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;

export const sourceWithBcs = (wsSource: string) => sourceWithSlash(wsSource) + bcsEndpoint;

/**
 * @param errorCodeMessages If not provided, error messages will be generic
 * @throws TRPCErrors
 */
export const handleErrorCodes = (
  code: string | number,
  errorCodeMessages?: {
    notFound: string;
    badRequest: string;
    internalServerError: string;
  },
) => {
  const parsedCode = typeof code === 'string' ? parseIntBase10(code || '500') : code;

  if (parsedCode >= 400) {
    if (parsedCode === 404) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: errorCodeMessages?.notFound || notFoundMessage,
      });
    }

    if (parsedCode < 500) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: errorCodeMessages?.badRequest || badRequestMessage,
      });
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: errorCodeMessages?.internalServerError || serverErrorMessage,
    });
  }
};

export const dateRangeFilters = (startDate: Date, endDate: Date): WsFilter[] => {
  return [
    { field: '_cdate', operator: '>=', value: format(startDate, 'yyyy-MM-dd') },
    { field: '_cdate', operator: '<=', value: format(endDate, 'yyyy-MM-dd') },
  ];
};

export const createdAtTodayFilters = (): WsFilter[] => {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  return [
    { field: '_cdate', operator: '>=', value: format(today, 'yyyy-MM-dd') },
    { field: '_cdate', operator: '<', value: format(tomorrow, 'yyyy-MM-dd') },
  ];
};

export const getAccountCards = async (
  webServiceSource: string,
  sessionId: string,
  companyCode: number,
  periodCode?: number,
  ba?: '(A)' | '(B)',
  params?: Record<string, unknown>,
  filters?: WsFilter[],
) => {
  const filtersWithBa = ba
    ? ([{ field: 'ba', operator: '=', value: ba }, ...(filters || [])] satisfies WsFilter[])
    : filters;

  return await myAxios.post<WsAccountCardListResponse>(
    sourceWithScf(webServiceSource),
    constructGetAccountCards(sessionId, companyCode, periodCode, params, filtersWithBa),
  );
};
