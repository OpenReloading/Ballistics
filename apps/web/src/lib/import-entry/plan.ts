/** The plan of one import against the stored records: added, already there, changed, repeated in the file. */
import { canonicalJson, planImport } from '../user-data.ts'
import type { Built, ImportedRecord } from './map.ts'

export interface ImportPlan {
  added: ImportedRecord[]
  equal: ImportedRecord[]
  /** Rows whose key is stored (or earlier in the file) with other content. */
  conflicts: { incoming: ImportedRecord; stored?: ImportedRecord; row?: number }[]
  /** Rows equal to an earlier row of the file. */
  repeated: number
}

const content = (r: ImportedRecord) => canonicalJson({ kind: r.kind, name: r.name, data: r.data })

/** Plans `built` against `stored`: rows with one key in the file collapse (equal) or conflict (other content, the first row wins). */
export function planBuilt(built: Built, stored: ImportedRecord[]): ImportPlan {
  const first = new Map<string, { record: ImportedRecord; row: number }>()
  let repeated = 0
  const inFile: ImportPlan['conflicts'] = []
  for (const e of built.entries) {
    const seen = first.get(e.record.id)
    if (!seen) first.set(e.record.id, { record: e.record, row: e.row })
    else if (content(seen.record) === content(e.record)) repeated++
    else inFile.push({ incoming: e.record, stored: seen.record, row: e.row })
  }
  const makers = new Map(built.makers.map((m) => [m.record.id, m.record]))
  const plan = planImport([...makers.values(), ...[...first.values()].map((f) => f.record)], stored)
  return {
    added: plan.added as ImportedRecord[],
    equal: plan.equal as ImportedRecord[],
    conflicts: [
      ...plan.conflicts.map((c) => ({
        incoming: c.incoming as ImportedRecord,
        stored: c.stored as ImportedRecord,
      })),
      ...inFile,
    ],
    repeated,
  }
}
