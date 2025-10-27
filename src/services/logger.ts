import type { FastifyBaseLogger } from 'fastify';

let loggerInstance: FastifyBaseLogger | null = null;

export function setLogger(logger: FastifyBaseLogger) {
  loggerInstance = logger;
}

export function getLogger() {
  if (!loggerInstance) {
    // Fallback to console.error if logger not initialized
    return {
      error: (...args: unknown[]) => console.error(...args),
      info: (...args: unknown[]) => console.info(...args),
      warn: (...args: unknown[]) => console.warn(...args),
    } as FastifyBaseLogger;
  }
  return loggerInstance;
}
