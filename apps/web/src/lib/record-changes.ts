/**
 * The values the user changed over what a record gives: the one rule of the changed mark, the
 * reset and, through `given` (`givenKeys` in `load-record.ts`), what a load saves as typed.
 */

import { followKeys, type Suggestions } from './input-defaults.ts'

/** A field value equal to the record's, within 1e-9 relative. */
const sameValue = (from: number, si: number) => Math.abs(si - from) <= 1e-9 * Math.abs(from)

/**
 * The record value of each key in `values` that a record gives and the user changed: a value is
 * there, `given` (a record, a default or the seating gives it) does not hold it, and it differs
 * from the record's. SI.
 */
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

/**
 * The values the chosen records give, by key, SI: the powder's model values, the bullet's, the
 * sheet's and powder's specs, the defaults of the followed fields (the volume only while no seating
 * owns it) and the firearm's weight.
 */
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
