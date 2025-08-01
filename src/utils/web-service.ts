import { sisEndpoint } from '../constants/endpoints.ts';
import { WsGetPeriodsRequest, WsLoginRequest } from '../types/web-service.ts';

export const constructLogin = (
  username: string,
  password: string,
  params: Record<string, unknown> = {},
  disconnect_same_user: 'True' | 'False' = 'False',
): WsLoginRequest => {
  return {
    login: {
      username,
      password,
      disconnect_same_user,
      params,
    },
  };
};

export const constructGetPeriods = (
  sessionId: string,
  companyCode: number,
  params: Record<string, unknown> = {},
): WsGetPeriodsRequest => {
  return {
    sis_firma_getir: {
      session_id: sessionId,
      firma_kodu: companyCode,
      params,
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
