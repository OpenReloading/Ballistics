import type { SpecValue } from '../core/types.ts'
import { type LengthUnit, lengthText } from '../core/units.ts'
import type { Side } from './figures.ts'
import { closedFront, storedValue } from './profile.ts'

/** The regions of the case in which chamber and cartridge dimensions are compared. */
export type RegionName = 'head' | 'body' | 'shoulder' | 'neck'

/** A region and, per symbol both sides publish, the chamber minimum minus the cartridge maximum in mm. */
export interface Region {
  name: RegionName
  values: { symbol: string; value: number }[]
}

/** The symbols compared in each region: the stored values whose difference `regions` gives. */
export const regionSymbols: Record<RegionName, string[]> = {
  head: ['R1', 'R3', 'R'],
  body: ['P1'],
  shoulder: ['P2', 'H1'],
  neck: ['H2'],
}

/** Caption text naming a region difference: the chamber minimum less the cartridge maximum, signed. */
export const differenceWording = 'nominal minimum difference of published dimensions'
/** The wording that names a negative region difference (chamber minimum below cartridge maximum). */
export const conflictWording =
  'data conflict between published cartridge maximum and chamber minimum (check source)'

/** The stored value when it is the column's limit: a cartridge maximum, a chamber minimum. */
function limitOf(values: SpecValue[], side: Side, symbol: string) {
  const v = storedValue(values, side, symbol)
  if (!v) return
  const other = side === 'cartridge' ? 'min' : 'max'
  const beyond = side === 'cartridge' ? v.tolerance?.upper : v.tolerance?.lower
  return v.limit === other || beyond ? undefined : v.value
}

/**
 * The regions of a record with their differences, from stored values only: head R1, R3 and R,
 * body P1, shoulder P2 and H1, neck H2. A chamber E is the recess depth, so the chamber R is
 * compared only where the chamber stores no E. None behind a closed front.
 */
export function regions(values: SpecValue[]): Region[] {
  if (closedFront(values)) return []
  const recessE = storedValue(values, 'chamber', 'E') !== undefined
  return (Object.entries(regionSymbols) as [RegionName, string[]][]).flatMap(([name, symbols]) => {
    const list = symbols.flatMap((symbol) => {
      if (symbol === 'R' && recessE) return []
      const [c, ch] = [limitOf(values, 'cartridge', symbol), limitOf(values, 'chamber', symbol)]
      return c === undefined || ch === undefined
        ? []
        : [{ symbol, value: Number((ch - c).toFixed(3)) }]
    })
    return list.length ? [{ name, values: list }] : []
  })
}

/** A difference with its sign; a negative one is a conflict. */
export const signedLengthText = (value: number, unit: LengthUnit = 'mm') =>
  value < 0 ? `−${lengthText(-value, unit)}` : value > 0 ? `+${lengthText(value, unit)}` : '0'

/** The callout text of a region, placed at it: "P2 +0.03, H1 +0.07"; a conflict marked. */
export const regionText = ({ values }: Region, unit: LengthUnit = 'mm') =>
  values
    .map((v) => `${v.symbol} ${signedLengthText(v.value, unit)}${v.value < 0 ? ' conflict' : ''}`)
    .join(', ')
