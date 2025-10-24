import type { TRPC_ERROR_CODE_KEY } from '@trpc/server';

export type Result<T> = readonly [
  message: string | null,
  statusCode: TRPC_ERROR_CODE_KEY | null,
  result: T | null,
];
