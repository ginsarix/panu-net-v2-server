export interface WsResponse {
  code: string;
  msg: string;
}

export type WsFilterOperators = '<' | '>' | '<=' | '>=' | '!' | '=' | 'IN' | 'NOT IN';
export type WsFilter = { field: string; operator: WsFilterOperators; value: string };

/**
 * Codes of turuack field
 *
 * Possible values:
 * - 1: Mal Alım
 * - 4: Konsinye Giriş
 * - 6: Mal Alım İade
 * - 9: Konsinye Giriş İade
 * - 12: Özel Giriş
 * - 15: Müstahsil İrsaliyesi
 * - 2: Perakende Satış
 * - 3: Toptan Satış
 * - 5: Konsinye Çıkış
 * - 7: Perakende Satış İade
 * - 8: Toptan Satış İade
 * - 11: Konsinye Çıkış İade
 * - 13: Özel Çıkış
 */
export type WsWaybillType =
  | '1'
  | '4'
  | '6'
  | '9'
  | '12'
  | '15'
  | '2'
  | '3'
  | '5'
  | '7'
  | '8'
  | '11'
  | '13';

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

/**
 * Codes of turu field
 *
 * Possible values:
 * - BNK: Banka Fişi
 * - GOHVL: Gonderilen Havale
 * - GEHVL: Gelen Havale
 * - VRM: Virman
 * - KF: Kur Farkı Fişi
 * - ACLS: Açılış Fişi
 */

export type WsBankReceiptType = 'BNK' | 'VRM' | 'GOHVL' | 'GEHVL' | 'KF' | 'ACLS';

/**
 * Codes of turu field
 *
 * Possible values:
 * - 1: Depo Fişi (Transfer)
 * - 3: Sarf Fişi
 * - 8: Sair Giriş
 * - 9: Sair Çıkış
 */
export type WsMaterialReceiptType = '1' | '3' | '8' | '9';

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
    turu: WsWaybillType;
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
    adi: string;
    aciklama: string;
    ba: '(B)' | '(A)';
    alacak: string;
    borc: string;
    bakiye: string;
    _cdate: string;
    _key: string; // used to get movements
  }[];
}

export type WsCashAccountMovementType =
  | 'TAH'
  | 'ODM'
  | 'YAT'
  | 'CEK'
  | 'MC_PT'
  | 'MS_PT'
  | 'KC_MT'
  | 'KS_MT'
  | 'ACBO'
  | 'ACAL'
  | 'VRBO'
  | 'VRAL'
  | 'KFBO'
  | 'KFAL'
  | 'HZMT'
  | 'GDPU'
  | 'VSMM'
  | 'ASMM'
  | '1'
  | '4'
  | '6'
  | '7'
  | '8'
  | '2'
  | '3'
  | '5'
  | 'OTAH'
  | 'OODM'
  | 'IKY'
  | 'IKC';

export interface WsGetCashAccountMovementsListResponse extends WsResponse {
  result: {
    fisno: string;
    alacak: string;
    borc: string;
    bakiye: string;
    aciklama: string;
    turu: WsCashAccountMovementType;
    turuack: string;
    _cdate: string;
  }[];
}

export interface WsGetBankReceiptListResponse extends WsResponse {
  result: {
    fisno: string;
    cariunvan: string;
    turu: WsBankReceiptType;
    doviz: string;
    alacak: string;
    borc: string;
    turuack: string;
    aciklama: string;
    kalemaciklama: string;
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
    turu: WsMaterialReceiptType;
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

export interface WsGetStocksResponse extends WsResponse {
  result: {
    stokkartkodu: string;
    aciklama: string;
    stokkartturu: string;
    fiili_stok: string;
    birimadi: string;
  }[];
}

export interface WsGetServicesResponse extends WsResponse {
  result: {
    hizmetkartkodu: string;
    aciklama: string;
    hizmetkartturuack: string;
    miktar: string;
    birimadi: string;
  }[];
}

export interface WsGetEmployeeTallyResponse extends WsResponse {
  result: {
    personeladisoyadi: string;
    personelsicilno: string;
    normalmesaisaat: string;
    toplamfazlamesaisaat: string;
    gecemesaisisaat: string;
    haftasonumesaisisaat: string;
    _cdate: string;
  }[];
}

export interface WsGetOrdersResponse extends WsResponse {
  result: {
    fisno: string;
    unvan: string;
    kartaciklama: string;
    miktar: string;
    anabirimi: string;
    birimfiyatidovizi: string;
    toplamtutar: string;
    tutari: string;
    turuack: 'Verilen Sipariş' | 'Alınan Sipariş';
    turu: '1' | '2';
    onay: 'KABUL' | 'TEKLIF' | 'ANALIZ' | 'RET';
    note: string;
    tamamisevkedildi: 't' | 'f'; // 🙄
    _cdate: string;
  }[];
}
