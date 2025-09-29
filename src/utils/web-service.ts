import { scfEndpoint, sisEndpoint } from '../constants/endpoints';
import type {
  WsFilters,
  WsGetAccountCardListRequest,
  WsGetCreditCountRequest,
  WsGetPeriodsRequest,
  WsLoginRequest,
} from '../types/web-service';

export const constructLogin = (
  username: string,
  password: string,
  params?: Record<string, unknown>,
  filters?: WsFilters,
  disconnect_same_user: 'True' | 'False' = 'False',
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
  filters?: WsFilters,
): WsGetAccountCardListRequest => ({
  scf_carikart_listele: {
    session_id: sessionId,
    firma_kodu: companyCode,
    donem_kodu: selectedPeriodCode,
    params,
    filters,
  },
});

export const constructGetPeriods = (
  sessionId: string,
  companyCode: number,
  params?: Record<string, unknown>,
  filters?: WsFilters,
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
  filters?: WsFilters,
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

export const sourceWithSis = (wsSource: string) => {
  sourceWithSlash(wsSource);

  return wsSource + sisEndpoint;
};

export const sourceWithScf = (wsSource: string) => sourceWithSlash(wsSource) + scfEndpoint;
