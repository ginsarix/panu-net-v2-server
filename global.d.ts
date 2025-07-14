declare module '@fastify/session' {
  interface FastifySessionObject {
    selectedCompanyId?: string;
    wsSessionId?: string;
  }
}
