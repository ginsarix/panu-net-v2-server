export interface WsResponse {
  code: string;
  msg: string;
}

export type WsFilterOperators = '<' | '>' | '<=' | '>=' | '!' | '=' | 'IN' | 'NOT IN';
export type WsFilters = { field: string; operator: WsFilterOperators; value: string }[];
export interface WsRequestGenerics {
  params?: Record<string, unknown>;
  filters?: WsFilters;
  limit?: number;
  offset?: number;
}

export interface WsLoginRequest {
  login: {
    username: string;
    password: string;
    disconnect_same_user: 'True' | 'False';
  } & WsRequestGenerics;
}

export interface WsGetAccountCardListRequest {
  scf_carikart_listele: {
    session_id: string;
    firma_kodu: string;
    donem_kodu: number;
  } & WsRequestGenerics;
}

export interface WsGetPeriodsRequest {
  sis_firma_getir: {
    session_id: string;
    firma_kodu: string;
  } & WsRequestGenerics;
}

export interface WsGetCreditCountRequest {
  sis_kontor_sorgula: {
    session_id: string;
  } & WsRequestGenerics;
}

export type WsLoginResponse = WsResponse;

// i know, retarded. blame the api.
export interface WsAccountCardListResponse extends WsResponse {
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

export interface WsGetCreditCountResponse extends Omit<WsResponse, 'msg'> {
  result: {
    kontorsayisi: number;
  };
}
