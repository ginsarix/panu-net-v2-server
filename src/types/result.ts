export type PureResult<T> = readonly [
  error: string | null,
  returned: T | null,
  statusCode?: number,
];