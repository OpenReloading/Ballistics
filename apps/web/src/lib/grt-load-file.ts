/** Load files of other programs read into user records, loaded by their format's `parse` only when such a file is read. */
import { readCsrLoad, readGrtLoad } from '@rangefoundry/importers'
import { type UserRecord, userRecord } from '@rangefoundry/schema'
import { z } from 'zod'
import { recordOf } from './candidates.ts'
import { readerErrorText } from './file-diagnostics.ts'
import { loadWarning } from './load-warnings.ts'
import type { ParsedUserFile } from './user-data.ts'

/** The records of the candidates `read` gives, each checked with the user record schema; the file is refused when one fails. */
function parseWith(read: typeof readGrtLoad, format: string, text: string): ParsedUserFile {
  let r: ReturnType<typeof readGrtLoad>
  try {
    r = read(text)
  } catch (e) {
    return {
      ok: false,
      reason: `The file is not a readable ${format}: ${readerErrorText(e)}`,
    }
  }
  const saved = new Date().toISOString()
  const records: UserRecord[] = []
  for (const x of r.candidates.map((c) => recordOf(c, saved))) {
    const parsed = userRecord.safeParse(x)
    if (!parsed.success) return { ok: false, reason: `${x.kind}: ${z.prettifyError(parsed.error)}` }
    records.push(parsed.data)
  }
  return { ok: true, records, unmapped: r.unmapped, warnings: r.warnings.map(loadWarning) }
}

/** A GRT load file's records, each checked with the user record schema. */
export const parseGrtLoad = (text: string) => parseWith(readGrtLoad, 'GRT load file', text)

/** A ChamberSim Reloaded load file's records, each checked with the user record schema. */
export const parseCsrLoad = (text: string) =>
  parseWith(readCsrLoad, 'ChamberSim Reloaded load file', text)
