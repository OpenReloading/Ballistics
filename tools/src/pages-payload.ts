import { globSync, rmSync } from 'node:fs'
import path from 'node:path'

/** Deletes every `__next._full.txt` under the static export `dir`, the page's RSC payload a second time (byte for byte its `index.txt`); gives the paths deleted, relative to `dir`. */
export function dropFullPayloads(dir: string) {
  // the export's client fetches `index.txt` to navigate and `__next.<segment>.txt` to prefetch, never `_full`
  const files = globSync('**/__next._full.txt', { cwd: dir })
  for (const f of files) rmSync(path.join(dir, f))
  return files
}
