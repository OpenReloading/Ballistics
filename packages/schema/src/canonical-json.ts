import { compareKeys } from './order.ts'

/** JSON text of `value` with the keys of every object in sorted order, so key order never changes it. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? // integer-like keys come first in ascending order whatever the insertion order: still deterministic
        Object.fromEntries(Object.entries(v).toSorted(([a], [b]) => compareKeys(a, b)))
      : v,
  )
}
