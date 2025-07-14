export interface WsResponse {
  code: string;
  msg: string;
}

export interface WsLoginRequest {
  login: {
    username: string;
    password: string;
    disconnect_same_user: 'True' | 'False';
    params: Record<string, unknown>;
  };
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
