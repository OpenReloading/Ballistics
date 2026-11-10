import type { Bundle } from './records.ts'

/** A record the public catalogue may not hold: it cites a manufacturer-origin source or a fitted source without an origin. */
export interface MakerRow {
  id: string
}

/** What a record carries that decides whether the public catalogue may hold it: its provenance, with the cited sources resolved. */
interface Cited {
  id: string
  provenance?:
    | {
        kind?: string | undefined
        sources?: { kind?: string | undefined; origin?: string | undefined }[]
      }
    | undefined
}

/** True when `record` may hold maker data: it cites a manufacturer-origin source, or a fitted source that does not say whose data it was fitted to. */
const mayHoldMakerData = (record: Cited) =>
  (record.provenance?.sources ?? []).some(
    (s) =>
      s.origin === 'manufacturer' ||
      (s.origin === undefined && (s.kind ?? record.provenance?.kind) === 'fitted'),
  )

/**
 * The records of `bundle` that cite a maker or a fitted source without an origin, by kind, in the order of the bundle;
 * kinds without one are left out. Manufacturer records are identity records and may cite their maker.
 */
export function makerRows(bundle: Bundle): Record<string, MakerRow[]> {
  const out: Record<string, MakerRow[]> = {}
  for (const [kind, records] of Object.entries(bundle)) {
    if (kind === 'manufacturers' || !Array.isArray(records)) continue
    const rows = (records as Cited[]).flatMap((r) => (mayHoldMakerData(r) ? [{ id: r.id }] : []))
    if (rows.length > 0) out[kind] = rows
  }
  return out
}
