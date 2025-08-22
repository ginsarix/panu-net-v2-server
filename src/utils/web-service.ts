import { sisEndpoint } from '../constants/endpoints.ts';
import {
  WsFilters,
  WsGetCreditCountRequest,
  WsGetPeriodsRequest,
  WsLoginRequest,
} from '../types/web-service.ts';

export const constructLogin = (
  username: string,
  password: string,
  params?: Record<string, unknown>,
  filters?: WsFilters,
  disconnect_same_user: 'True' | 'False' = 'False',
): WsLoginRequest => {
  return {
    login: {
      username,
      password,
      disconnect_same_user,
      params,
      filters,
    },
  };
};

export const constructGetAccountCards = (
  sessionId: string,
  companyCode: string,
  selectedPeriodCode: number = 0,
  params?: Record<string, unknown>,
  filters?: WsFilters,
) => {
  return {
    scf_carikart_listele: {
      session_id: sessionId,
      firma_kodu: companyCode,
      donem_kodu: selectedPeriodCode,
      params,
      filters,
    },
  };
};

export const constructGetPeriods = (
  sessionId: string,
  companyCode: string,
  params?: Record<string, unknown>,
  filters?: WsFilters,
): WsGetPeriodsRequest => {
  return {
    sis_firma_getir: {
      session_id: sessionId,
      firma_kodu: companyCode,
      params,
      filters,
    },
  };
};

export const constructGetCreditCount = (
  sessionId: string,
  params?: Record<string, unknown>,
  filters?: WsFilters,
): WsGetCreditCountRequest => {
  return {
    sis_kontor_sorgula: {
      session_id: sessionId,
      params,
      filters,
    },
  };
};

export const sourceWithSlash = (wsSource: string) => {
  return wsSource.endsWith('/') ? wsSource : wsSource + '/';
};

export const sourceWithSis = (wsSource: string) => {
  sourceWithSlash(wsSource);

  return wsSource + sisEndpoint;
};
