export interface WsResponse {
  code: string;
  msg: string;
}

export interface WsGenericParams {
  params: Record<string, unknown>;
}

export interface WsLoginRequest {
  login: {
    username: string;
    password: string;
    disconnect_same_user: 'True' | 'False';
  } & WsGenericParams;
}

export interface WsGetPeriodsRequest {
  sis_firma_getir: {
    session_id: string;
    firma_kodu: number;
  } & WsGenericParams;
}

export type WsLoginResponse = WsResponse;

// i know, retarded. blame the api.
export interface WsScfListResponse extends WsResponse {
  result: {
    carikartkodu: string;
    unvan: string;
    dovizturu: string;
    bakiye: string;
    ba: '(B)' | '(A)';
  }[];
}

export interface WsGetPeriodsResponse extends WsResponse {
  result: {
    m_donemler: {
      donemkodu: number;
      baslangic: string;
      bitis: string;
    }[];
  };
}
