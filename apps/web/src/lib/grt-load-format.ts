/** The load-file format entry of GRT load files; its reader `grt-load-file.ts` loads with the first read. */
import type { LoadFileFormat } from './load-file-formats.ts'

const root = '<GordonsReloadingTool'

/**
 * Whether the root element of `text` is the one of a GRT load file, past the processing
 * instructions (the declaration too) and comments the XML reader skips before it.
 */
function grtRoot(text: string) {
  let i = 0
  for (;;) {
    while (/\s/.test(text.charAt(i))) i++
    const [open, close] = text.startsWith('<?', i)
      ? ['<?', '?>']
      : text.startsWith('<!--', i)
        ? ['<!--', '-->']
        : []
    if (!open || !close)
      return text.startsWith(root, i) && /[\s/>]/.test(text.charAt(i + root.length))
    const end = text.indexOf(close, i + open.length)
    if (end < 0) return false
    i = end + close.length
  }
}

export const grtLoadFormat: LoadFileFormat = {
  name: 'GRT load file',
  accept: { 'application/xml': ['.grtload'] },
  detect: (bytes) => grtRoot(new TextDecoder().decode(bytes)),
  // a plain import(): the reader is part of the chunk of a read, not of every route
  parse: async (bytes) =>
    (await import('./grt-load-file.ts')).parseGrtLoad(new TextDecoder().decode(bytes)),
}
