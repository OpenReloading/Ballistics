/** Load files of other programs read into user records, loaded by their format's `parse` only when such a file is read. */
import { readCsrLoad, readGrtLoad } from '@open-reloading/importers'
import { type UserRecord, userRecord } from '@open-reloading/schema'
import { z } from 'zod'
import type { ParsedUserFile } from './user-data.ts'

/** The records `read` gives, each checked with the user record schema; the file is refused when one fails. */
function parseWith(read: typeof readGrtLoad, format: string, text: string): ParsedUserFile {
  let r: ReturnType<typeof readGrtLoad>
  try {
    r = read(text, new Date().toISOString())
  } catch (e) {
    return {
      ok: false,
      reason: `The file is not a readable ${format}: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
  const records: UserRecord[] = []
  for (const x of r.records) {
    const parsed = userRecord.safeParse(x)
    if (!parsed.success) return { ok: false, reason: `${x.kind}: ${z.prettifyError(parsed.error)}` }
    records.push(parsed.data)
  }
  return { ok: true, records, unmapped: r.unmapped, warnings: r.warnings }
}

/** A GRT load file's records, each checked with the user record schema. */
export const parseGrtLoad = (text: string) => parseWith(readGrtLoad, 'GRT load file', text)

/** A ChamberSim Reloaded load file's records, each checked with the user record schema. */
export const parseCsrLoad = (text: string) =>
  parseWith(readCsrLoad, 'ChamberSim Reloaded load file', text)
