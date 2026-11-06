import type { Bundle } from './records.ts'

/** Why a record leaves the public catalogue: it cites a manufacturer, or its values are derived or fitted from such data. */
type LeaveReason = 'manufacturer source' | 'derived' | 'fitted'

/** A record that leaves the public catalogue, with the reason. */
export interface MakerRow {
  id: string
  reason: LeaveReason
}

/** What a record carries that decides whether it leaves: its provenance, with the cited sources resolved. */
interface Cited {
  id: string
  provenance?: { kind?: string; sources?: { origin?: string | undefined }[] } | undefined
}

/** The fields a manufacturer record keeps as an identity record. */
const identityFields = new Set(['id', 'name', 'website', 'provenance'])

/**
 * Why `record` of `kind` leaves, or undefined when it stays: a record that cites any
 * manufacturer-origin source leaves whole, also when it cites other sources too, and a powder
 * derived or fitted from maker data leaves.
 */
function leaveReason(kind: string, record: Cited): LeaveReason | undefined {
  const sources = record.provenance?.sources ?? []
  if (sources.some((s) => s.origin === 'manufacturer')) return 'manufacturer source'
  const how = record.provenance?.kind
  if (kind === 'powders' && (how === 'derived' || how === 'fitted')) return how
  return undefined
}

/**
 * The records of `bundle` that leave the public catalogue, by kind, in the order of the bundle;
 * kinds without one are left out. Manufacturer records stay as identity records
 * ({@link manufacturerExtras}).
 */
export function makerRows(bundle: Bundle): Record<string, MakerRow[]> {
  const out: Record<string, MakerRow[]> = {}
  for (const [kind, records] of Object.entries(bundle)) {
    if (kind === 'manufacturers' || !Array.isArray(records)) continue
    const rows = (records as Cited[]).flatMap((r) => {
      const reason = leaveReason(kind, r)
      return reason ? [{ id: r.id, reason }] : []
    })
    if (rows.length > 0) out[kind] = rows
  }
  return out
}

/** The manufacturer records with fields beyond their identity (name, website), and those fields. */
export function manufacturerExtras(bundle: Bundle): { id: string; fields: string[] }[] {
  return bundle.manufacturers.flatMap((m) => {
    const fields = Object.keys(m).filter((k) => !identityFields.has(k))
    return fields.length > 0 ? [{ id: m.id, fields }] : []
  })
}
