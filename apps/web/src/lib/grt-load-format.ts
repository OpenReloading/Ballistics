/** The load-file format entry of GRT load files; its reader `grt-load-file.ts` loads with the first read. */
import type { LoadFileFormat } from './load-file-formats.ts'

/** One processing instruction (the declaration too) or comment before the root, as the XML reader skips them. */
const preamble = /\s*(?:<\?[\s\S]*?\?>|<!--[\s\S]*?-->)/y
const root = /\s*<GordonsReloadingTool[\s/>]/y

/** Whether the root element of `text` is the one of a GRT load file. */
function grtRoot(text: string) {
  let at = 0
  // each step ends past its own markup, so the text is read once
  for (preamble.lastIndex = 0; preamble.test(text); ) at = preamble.lastIndex
  root.lastIndex = at
  return root.test(text)
}

export const grtLoadFormat: LoadFileFormat = {
  name: 'GRT load file',
  accept: { 'application/xml': ['.grtload'] },
  detect: (bytes) => grtRoot(new TextDecoder().decode(bytes)),
  // a plain import(): the reader is part of the chunk of a read, not of every route
  parse: async (bytes) =>
    (await import('./grt-load-file.ts')).parseGrtLoad(new TextDecoder().decode(bytes)),
}
