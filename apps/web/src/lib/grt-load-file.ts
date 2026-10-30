/** A GRT load file read into user records, loaded by its format's `parse` only when such a file is read. */
import { readGrtLoad } from '@open-reloading/importers'
import { type UserRecord, userRecord } from '@open-reloading/schema'
import { z } from 'zod'
import type { ParsedUserFile } from './user-data.ts'

/** The records of the file, each checked with the user record schema; the file is refused when one fails. */
export function parseGrtLoad(text: string): ParsedUserFile {
  let read: ReturnType<typeof readGrtLoad>
  try {
    read = readGrtLoad(text, new Date().toISOString())
  } catch (e) {
    return {
      ok: false,
      reason: `The file is not a readable GRT load file: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
  const records: UserRecord[] = []
  for (const r of read.records) {
    const parsed = userRecord.safeParse(r)
    if (!parsed.success) return { ok: false, reason: `${r.kind}: ${z.prettifyError(parsed.error)}` }
    records.push(parsed.data)
  }
  return { ok: true, records, unmapped: read.unmapped, warnings: read.warnings }
}
