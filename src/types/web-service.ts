export interface WsResponse {
  code: string;
  msg: string;
}

export type WsFilterOperators = '<' | '>' | '<=' | '>=' | '!' | '=' | 'IN' | 'NOT IN';
export type WsFilter = { field: string; operator: WsFilterOperators; value: string };

/**
 * Codes of turu field
 *
 * Possible values:
 * - 1: Mal Alım
 * - 4: Alınan Hizmet
 * - 6: Alım İade
 * - 15: Müstahsil Makbuzu
 * - 7: Perakende Satış İade
 * - 8: Toptan Satış İade
 * - 2: Perakende Satış
 * - 3: Toptan Satış
 * - 5: Verilen Hizmet
 * - 9: Alınan Fiyat Farkı
 * - 10: Verilen Fiyat Farkı
 */
export type WsInvoiceType = '1' | '4' | '6' | '15' | '7' | '8' | '2' | '3' | '5' | '9' | '10';
export interface WsRequestGenerics {
  params?: Record<string, unknown>;
  filters?: WsFilter[];
  limit?: number;
  offset?: number;
}

export interface WsLoginRequest {
  login: {
    username: string;
    password: string;
    disconnect_same_user: 'true' | 'false';
  } & WsRequestGenerics;
}

export interface WsGetAccountCardListRequest {
  scf_carikart_listele: {
    session_id: string;
    firma_kodu: number;
    donem_kodu: number;
  } & WsRequestGenerics;
}

export interface WsGetPeriodsRequest {
  sis_firma_getir: {
    session_id: string;
    firma_kodu: number;
  } & WsRequestGenerics;
}

export interface WsGetInvoicesRequest {
  scf_fatura_listele_ayrintili: {
    session_id: string;
    firma_kodu: number;
    donem_kodu: number;
  } & WsRequestGenerics;
}

export interface WsGetCreditCountRequest {
  sis_kontor_sorgula: {
    session_id: string;
  } & WsRequestGenerics;
}

export type WsLoginResponse = WsResponse;

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

export interface WsGetWaybillListResponse extends WsResponse {
  result: {
    turuack: string;
    fisno: string;
    belgeno2: string;
    cariunvan: string;
    doviz: string;
    stokaciklama: string;
    stokkartkodu: string;
    tutari: string;
    miktar: string;
    fatbirimi: string;
    kdvtutari: string;
    indirimtutari: string;
    toplamtutar: string;
    _cdate: string;
  }[];
}

export interface WsGetInvoiceListResponse extends WsResponse {
  result: {
    kartaciklama: string;
    kartkodu: string;
    turuack: string;
    turu: WsInvoiceType;
    belgeno2: string;
    kalemdovizi: string;
    fisno: string;
    miktar: string;
    birim: string;
    unvan: string;
    kdvharictutar: string;
    kdvtutari: string;
    indirimtutari: string;
    toplamtutar: string;
    _cdate: string;
  }[];
}

export interface WsGetCashAccountListResponse extends WsResponse {
  result: {
    ba: '(B)' | '(A)';
    alacak: string;
    borc: string;
    bakiye: string;
    _cdate: string;
  }[];
}

export interface WsGetBankReceiptListResponse extends WsResponse {
  result: {
    fisno: string;
    borc: string;
    turuack: string;
    aciklama: string;
    _cdate: string;
  }[];
}

export interface WsGetCashCollectionListResponse extends WsResponse {
  result: {
    cariunvan: string;
    dovizturu: string;
    toplamtutar: string;
    bankahesapadi: string;
    aciklama: string;
    devirfisno: string;
    _cdate: string;
  }[];
}

export interface WsGetMaterialReceiptListResponse extends WsResponse {
  result: {
    fisno: string;
    cariunvan: string;
    aciklama: string;
    turuack: string;
    _cdate: string;
    toplam: string;
    stokkodu: string;
    stokadi: string;
    doviz: string;
    birim: string;
    miktar: string;
  }[];
}

export interface WsGetCheckEntriesListResponse extends WsResponse {
  result: {
    bordrono: string;
    tutar: string;
    doviz: string;
    vade: string;
    cirolu: 'E' | 'H';
    aciklama: string;
    bankadi: string;
    borclu: string;
    _cdate: string;
  }[];
}
