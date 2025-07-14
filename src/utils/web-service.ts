import { WsLoginRequest } from '../types/web-service.ts';

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

export const sourceWithSlash = (wsSource: string) => {
  return wsSource.endsWith('/') ? wsSource : wsSource + '/';
};
