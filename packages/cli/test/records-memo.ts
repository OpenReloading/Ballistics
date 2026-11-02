import type * as data from '@open-reloading/data'

/**
 * The data package with `readRecords` read once per set of roots and cloned on each call: a test
 * file runs the command line many times over the same unchanged record folders. Use as
 * `vi.mock('@open-reloading/data', async (original) => memoRecords(await original()))`.
 */
export function memoRecords(original: typeof data): typeof data {
  const read = new Map<string, data.ReadRecordsResult>()
  return {
    ...original,
    readRecords: (root) => {
      const key = JSON.stringify(root ?? null)
      const hit = read.get(key) ?? original.readRecords(root)
      read.set(key, hit)
      return structuredClone(hit)
    },
  }
}
