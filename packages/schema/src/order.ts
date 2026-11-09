/** A precomputed key per row compared by code unit, so the API and the browser order alike, whatever the runtime's locale data. */
import { fold } from './search.ts'

const padDigits = (s: string) => s.replace(/\d+/g, (run) => run.padStart(8, '0'))

/** The key of a row: each name folded, digit runs padded to 8 digits (9 before 10), joined by U+001F. */
export const sortKey = (...names: string[]): string =>
  names.map((n) => padDigits(fold(n))).join('\u001f')

/** Orders two sort keys by UTF-16 code unit. */
export const compareKeys = (a: string, b: string): -1 | 0 | 1 => {
  if (a < b) return -1
  return a > b ? 1 : 0
}
