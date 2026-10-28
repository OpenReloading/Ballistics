/** What a record page reads besides its record, through `apiFetch`: lists, and records by id that must exist. */

import { apiFetch, fetchRecord } from './api-fetch.ts'
import type { ListOf } from './api-types.ts'

/** The items of a list route that takes no paging (federations, disciplines, target mappings, caliber classes). */
export async function readItems<T>(path: string, signal: AbortSignal) {
  const res = await apiFetch(path, { signal })
  if (!res.ok) throw new Error(`The API answered ${res.status}.`)
  return ((await res.json()) as ListOf<T>).items
}

/** The record `<kind>/<id>`, a throw when there is none: a record a listed one names must exist. */
export async function readRecord<T>(kind: string, id: string, signal: AbortSignal) {
  const record = await fetchRecord<T>(kind, id, signal)
  if (record === undefined) throw new Error(`${kind}/${id} is missing.`)
  return record
}
