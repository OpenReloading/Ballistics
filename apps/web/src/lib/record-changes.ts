/** The one rule behind the changed mark, the reset and what a load saves as typed (`givenKeys` in `load-record.ts`). */

import { followKeys, type Suggestions } from './input-defaults.ts'

/** A field value equal to the record's, within 1e-9 relative. */
const sameValue = (from: number, si: number) => Math.abs(si - from) <= 1e-9 * Math.abs(from)

/** Only values `given` does not hold and that differ from the record's; SI. */
export function changedFromRecord(
  values: Record<string, number | undefined>,
  recordValues: Record<string, number | undefined>,
  given: ReadonlySet<string>,
) {
  const changed: Record<string, number> = {}
  for (const [key, from] of Object.entries(recordValues)) {
    const si = values[key]
    if (from === undefined || si === undefined || given.has(key) || sameValue(from, si)) continue
    changed[key] = from
  }
  return changed
}

/** The volume default only while no seating owns it; SI. */
export function recordValuesOf(a: {
  origin: Record<string, number> | undefined
  bullet: Record<string, number | undefined>
  /** The cartridge sheet's Pmax and L3 and the powder's bulk density (`record-specs.ts`). */
  specs: Record<string, number | undefined>
  suggestions: Suggestions
  seatingOwnsVolume: boolean
  firearmMass: number | undefined
}): Record<string, number | undefined> {
  const out: Record<string, number | undefined> = { ...a.origin, ...a.bullet, ...a.specs }
  for (const key of followKeys)
    if (key !== 'volume' || !a.seatingOwnsVolume) out[key] = a.suggestions[key]?.si
  out.firearmMass = a.firearmMass
  return out
}
