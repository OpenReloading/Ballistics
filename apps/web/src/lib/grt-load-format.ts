/** The load-file format entry of GRT load files; its reader `grt-load-file.ts` loads with the first read. */
import type { LoadFileFormat } from './load-file-formats.ts'

/** An XML document whose root element is the one of a GRT load file, told from its first bytes. */
const start = /^\s*(<\?xml[^>]*\?>\s*)?<GordonsReloadingTool[\s>]/

export const grtLoadFormat: LoadFileFormat = {
  name: 'GRT load file',
  accept: { 'application/xml': ['.grtload'] },
  detect: (bytes) => start.test(new TextDecoder().decode(bytes.subarray(0, 1024))),
  // a plain import(): the reader is part of the chunk of a read, not of every route
  parse: async (bytes) =>
    (await import('./grt-load-file.ts')).parseGrtLoad(new TextDecoder().decode(bytes)),
}
