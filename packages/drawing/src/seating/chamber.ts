import { storedValue } from '../cartridge/profile.ts'
import type { SpecValue } from '../core/types.ts'

/** The values of a CIP record the preview reads: the cartridge L3 (case length) and L6, the chamber throat. */
export interface SeatingValues {
  caseLength: number
  cartridgeL6?: number
  /** Chamber L3, mm. */
  chamberL3?: number
  G1?: number
  F?: number
  /** Chamber G: the leade end past chamber L3, mm. */
  leadeEnd?: number
  /** Chamber s: the leade start past chamber L3, mm. */
  leadeStart?: number
  /** Chamber i: the leade angle to the axis, degrees. */
  leadeAngle?: number
}

/**
 * The chamber values the preview reads, in mm and degrees, from stored values: the cartridge L3
 * as `caseLength` and L6, the chamber L3, G1, F, G, s and i. Undefined without a cartridge L3.
 */
export function chamberOf(values: SpecValue[]): SeatingValues | undefined {
  const c = (symbol: string) => storedValue(values, 'cartridge', symbol)?.value
  const ch = (symbol: string) => storedValue(values, 'chamber', symbol)?.value
  const caseLength = c('L3')
  if (caseLength === undefined) return
  return {
    caseLength,
    cartridgeL6: c('L6'),
    chamberL3: ch('L3'),
    G1: ch('G1'),
    F: ch('F'),
    leadeEnd: ch('G'),
    leadeStart: ch('s'),
    leadeAngle: ch('i'),
  }
}
