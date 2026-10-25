import { readFileSync } from 'node:fs'

const root = new URL('../../../packages/data/records/', import.meta.url)

/** What `JSON.parse` returns: a record read by field name without a schema type. */
export type ParsedRecord = ReturnType<typeof JSON.parse>

/** The record at `<kind>/<id>.json` of the records folder. */
export function readRecord<T = ParsedRecord>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T
}
