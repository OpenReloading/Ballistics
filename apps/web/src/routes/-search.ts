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
