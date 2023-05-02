export type ExtendArray<T> = T extends Array<infer ItemType> ? ItemType | T : T | T[]

export function forceArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}
