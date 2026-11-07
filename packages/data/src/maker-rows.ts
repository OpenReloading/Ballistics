import type { Bundle } from './records.ts'

/** A record the public catalogue may not hold: it cites a manufacturer-origin source. */
export interface MakerRow {
  id: string
}

/** What a record carries that decides whether the public catalogue may hold it: its provenance, with the cited sources resolved. */
interface Cited {
  id: string
  provenance?: { sources?: { origin?: string | undefined }[] } | undefined
}

/** True when `record` cites any manufacturer-origin source, also beside other sources. */
const citesMaker = (record: Cited) =>
  (record.provenance?.sources ?? []).some((s) => s.origin === 'manufacturer')

/**
 * The records of `bundle` the public catalogue may not hold, by kind, in the order of the bundle;
 * kinds without one are left out. Manufacturer records are identity records and may cite their maker.
 */
export function makerRows(bundle: Bundle): Record<string, MakerRow[]> {
  const out: Record<string, MakerRow[]> = {}
  for (const [kind, records] of Object.entries(bundle)) {
    if (kind === 'manufacturers' || !Array.isArray(records)) continue
    const rows = (records as Cited[]).flatMap((r) => (citesMaker(r) ? [{ id: r.id }] : []))
    if (rows.length > 0) out[kind] = rows
  }
  return out
}
