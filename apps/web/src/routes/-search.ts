import { z } from 'zod'

/** The address's query as strings, the first of a repeated key: the lists read it with `URLSearchParams`, as the Next pages do, so `6.50` and `1e3` stay as typed. */
export function parseSearch(search: string): Record<string, string> {
  const read: Record<string, string> = {}
  for (const [key, value] of new URLSearchParams(search)) read[key] ??= value
  return read
}

/** The query `parseSearch` read, written with `URLSearchParams` as `writeDirectory` does; empty without a key. */
export function stringifySearch(search: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) p.append(key, String(value))
  }
  const written = p.toString()
  return written ? `?${written}` : ''
}

// the router reads `?bullet=308` as a number; the views read the address themselves, so a value keeps its form
const param = z.union([z.string(), z.number()]).optional().catch(undefined)

/** The query parameters a page's views read from the address, each optional; any other key stays in it. */
export const searchOf = <K extends string>(...keys: K[]) =>
  z.looseObject(Object.fromEntries(keys.map((key) => [key, param])) as Record<K, typeof param>)
