/** The load-file format entry of ChamberSim Reloaded load files; its reader `grt-load-file.ts` loads with the first read. */
import { rootIs } from './grt-load-format.ts'
import type { LoadFileFormat } from './load-file-formats.ts'

export const csrLoadFormat: LoadFileFormat = {
  name: 'ChamberSim Reloaded load file',
  accept: { 'application/xml': ['.csrload'] },
  detect: (bytes) => rootIs(new TextDecoder().decode(bytes), 'ChamberSimReloaded'),
  // a plain import(): the reader is part of the chunk of a read, not of every route
  parse: async (bytes) =>
    (await import('./grt-load-file.ts')).parseCsrLoad(new TextDecoder().decode(bytes)),
}
