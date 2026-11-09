import type * as reader from '@open-reloading/tools/catalog'

/** `readRecords` read once per set of roots and cloned on each call, as a test file runs the command line many times over the same record folders; use as `vi.mock('@open-reloading/tools/catalog', async (original) => memoRecords(await original()))`. */
export function memoRecords(original: typeof reader): typeof reader {
  const read = new Map<string, reader.ReadRecordsResult>()
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
