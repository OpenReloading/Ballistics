import { readFileSync } from 'node:fs'

const root = new URL('../../../packages/data/records/', import.meta.url)

/** The record at `<kind>/<id>.json` of the records folder. */
export function readRecord<T = any>(path: string): T {
  return JSON.parse(readFileSync(new URL(path, root), 'utf8')) as T
}
