import { readFileSync } from 'node:fs'

const root = new URL('../../../packages/data/records/', import.meta.url)

/** The record at `<kind>/<id>.json` of the records folder; untyped, its fields are read by name. */
export function readRecord<T = ReturnType<typeof JSON.parse>>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T
}
