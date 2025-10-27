import 'fastify';

declare module '@mgcrea/fastify-session' {
  interface SessionData {
    login?: {
      id: string;
      name: string;
      email: string;
      role: 'user' | 'admin';
      token: string;
    };
    wsSessionId?: string; // ws means web service here
    selectedCompanyId?: number;
    selectedPeriodCode?: number;
  }
}
