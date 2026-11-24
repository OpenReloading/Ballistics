import { z } from 'zod'

/** The address's query as strings, a repeated key as all its values: the views read it with `URLSearchParams`, as the Next pages do, so `6.50` and `1e3` stay as typed. */
export function parseSearch(search: string): Record<string, string | string[]> {
  const read: Record<string, string | string[]> = Object.create(null)
  for (const [key, value] of new URLSearchParams(search)) {
    const seen = read[key]
    read[key] = seen === undefined ? value : [...(Array.isArray(seen) ? seen : [seen]), value]
  }
  return read
}

/** The query `parseSearch` read, written as `writeDirectory` writes it: each value of an array as its own key, `,` and `/` as typed; empty without a key. */
export function stringifySearch(search: Record<string, unknown>): string {
  const p = new URLSearchParams()
  for (const [key, value] of Object.entries(search)) {
    for (const v of Array.isArray(value) ? value : [value])
      if (v !== undefined) p.append(key, String(v))
  }
  const written = p.toString().replaceAll('%2C', ',').replaceAll('%2F', '/')
  return written ? `?${written}` : ''
}

// the router reads `?bullet=308` as a number; the views read the address themselves, so a value keeps its form
const param = z.union([z.string(), z.number()]).optional().catch(undefined)

/** The query parameters a page's views read from the address, each optional; any other key stays in it. */
export const searchOf = <K extends string>(...keys: K[]) =>
  z.looseObject(Object.fromEntries(keys.map((key) => [key, param])) as Record<K, typeof param>)
