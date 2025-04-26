export type WithUnknown<T> = {
  [K in keyof T]: unknown
}