export const PAGE_ROLE_KEYS = {
  DEBTOR_VIEW: 'debtor_view',
  CREDITOR_VIEW: 'creditor_view',
  SUBSCRIPTION_VIEW: 'subscription_view',
  CUSTOMER_VIEW: 'customer_view',
  REPORT_VIEW: 'report_view',
  RECEIVED_ORDER_VIEW: 'received_order_view',
  DISPATCHED_ORDER_VIEW: 'dispatched_order_view',
  CONTRACT_VIEW: 'contract_view',
  STOCKS_VIEW: 'stocks_view',
  SERVICES_VIEW: 'services_view',
} as const;

export type PageRoleKey = (typeof PAGE_ROLE_KEYS)[keyof typeof PAGE_ROLE_KEYS];

export interface PageRoleDefinition {
  key: PageRoleKey;
  name: string;
  description: string;
  pagePath: string;
}

export const PAGE_ROLE_DEFINITIONS: PageRoleDefinition[] = [
  {
    key: PAGE_ROLE_KEYS.DEBTOR_VIEW,
    name: 'Borçlu',
    description: 'Borçlu sayfasına erişim yetkisi',
    pagePath: '/dbcr/debtors',
  },
  {
    key: PAGE_ROLE_KEYS.CREDITOR_VIEW,
    name: 'Alacaklı',
    description: 'Alacaklı sayfasına erişim yetkisi',
    pagePath: '/dbcr/creditors',
  },
  {
    key: PAGE_ROLE_KEYS.SUBSCRIPTION_VIEW,
    name: 'Abonelik',
    description: 'Abonelik sayfasına erişim yetkisi',
    pagePath: '/task-tracking/subscriptions',
  },
  {
    key: PAGE_ROLE_KEYS.CUSTOMER_VIEW,
    name: 'Abonelik Müşterileri',
    description: 'Abonelik müşterileri sayfasına erişim yetkisi',
    pagePath: '/task-tracking/customers',
  },
  {
    key: PAGE_ROLE_KEYS.REPORT_VIEW,
    name: 'Rapor',
    description: 'Rapor sayfasına erişim yetkisi',
    pagePath: '/reports/general-report',
  },
  {
    key: PAGE_ROLE_KEYS.CONTRACT_VIEW,
    name: 'Sözleşme',
    description: 'Sözleşme sayfasına erişim yetkisi',
    pagePath: '/contracts',
  },
  {
    key: PAGE_ROLE_KEYS.STOCKS_VIEW,
    name: 'Stoklar',
    description: 'Stoklar sayfasına erişim yetkisi',
    pagePath: '/stocks',
  },
  {
    key: PAGE_ROLE_KEYS.SERVICES_VIEW,
    name: 'Hizmetler',
    description: 'Hizmetler sayfasına erişim yetkisi',
    pagePath: '/stocks/service-list',
  },
];
