/** The load-file format entry of ChamberSim Reloaded load files; its reader `grt-load-file.ts` loads with the first read. */
import type { LoadFileFormat } from './load-file-formats.ts'

/** An XML document whose root element is the one of a ChamberSim Reloaded load file, told from its first bytes. */
const start = /^\s*(<\?xml[^>]*\?>\s*)?<ChamberSimReloaded[\s>]/

export const csrLoadFormat: LoadFileFormat = {
  name: 'ChamberSim Reloaded load file',
  accept: { 'application/xml': ['.csrload'] },
  detect: (bytes) => start.test(new TextDecoder().decode(bytes.subarray(0, 1024))),
  // a plain import(): the reader is part of the chunk of a read, not of every route
  parse: async (bytes) =>
    (await import('./grt-load-file.ts')).parseCsrLoad(new TextDecoder().decode(bytes)),
}
