import 'fastify';

declare module 'fastify' {
  interface Session {
    login?: {
      id: string;
      name: string;
      email: string;
      role: 'user' | 'admin';
    };
    wsSessionId?: string; // ws means web service here
    selectedCompanyId?: number;
    selectedPeriodCode?: number;
  }
}
