/** Every rule that tells a user something about a run (`apps/docs/docs/models/interior-m3.md`, "Advisories"): an `error` blocks a run, a `warn` or `info` never changes a result; the words live with the API. */
import type { InteriorLoad } from './interior/model.ts'
import type { Complete } from './key-list.ts'

/** How a rule bears on a run: `error` blocks it, `warn` and `info` leave the result as it is. */
export type AdvisorySeverity = 'error' | 'warn' | 'info'

/** The code of a rule of the registry, the `code` of an API warning. */
export type AdvisoryId =
  | 'limitExceeded'
  | 'noCartridge'
  | 'noComparableLimit'
  | 'rangeIncomplete'
  | 'chargeTooSmall'
  | 'resistanceNotApplied'
  | 'loadRatioHigh'
  | 'startPressureBelowResistance'
  | 'gyrationRadiusWithoutTwist'
  | 'startPressureHeldOnce'

/** One rule of the registry. */
export interface AdvisoryRule {
  id: AdvisoryId
  severity: AdvisorySeverity
  /** The inputs the rule reads: keys of the interior load, or `cartridge`, `tolerances`. */
  inputs: readonly string[]
}

// in the order the API lists its warning codes; the checks fail on a code left out or not in AdvisoryId
const codes = [
  'limitExceeded',
  'noCartridge',
  'noComparableLimit',
  'rangeIncomplete',
  'chargeTooSmall',
  'resistanceNotApplied',
  'loadRatioHigh',
  'startPressureBelowResistance',
  'gyrationRadiusWithoutTwist',
  'startPressureHeldOnce',
] as const satisfies readonly AdvisoryId[]

/** Every code of the registry, in registry order. */
export const advisoryIds: readonly [AdvisoryId, ...AdvisoryId[]] = codes satisfies Complete<
  AdvisoryId,
  typeof codes
>

/** The rule of each code. */
export const advisoryRule: Readonly<Record<AdvisoryId, AdvisoryRule>> = {
  limitExceeded: { id: 'limitExceeded', severity: 'warn', inputs: ['cartridge'] },
  noCartridge: { id: 'noCartridge', severity: 'info', inputs: ['cartridge'] },
  noComparableLimit: { id: 'noComparableLimit', severity: 'info', inputs: ['cartridge'] },
  rangeIncomplete: { id: 'rangeIncomplete', severity: 'warn', inputs: ['tolerances'] },
  chargeTooSmall: {
    id: 'chargeTooSmall',
    severity: 'warn',
    inputs: ['charge', 'startPressure', 'ignitionPressure'],
  },
  resistanceNotApplied: { id: 'resistanceNotApplied', severity: 'warn', inputs: ['resistance'] },
  loadRatioHigh: {
    id: 'loadRatioHigh',
    severity: 'warn',
    inputs: ['charge', 'chamber.volume', 'propellant.density'],
  },
  startPressureBelowResistance: {
    id: 'startPressureBelowResistance',
    severity: 'warn',
    inputs: ['startPressure', 'resistance.friction', 'resistance.engraving'],
  },
  gyrationRadiusWithoutTwist: {
    id: 'gyrationRadiusWithoutTwist',
    severity: 'warn',
    inputs: ['bullet.gyrationRadius', 'barrel.twist'],
  },
  startPressureHeldOnce: {
    id: 'startPressureHeldOnce',
    severity: 'info',
    inputs: ['startPressure', 'ignitionPressure', 'resistance.friction', 'resistance.engraving'],
  },
}

/** The inputs of an interior load that the input rules read. */
export type AdvisoryLoad = Pick<
  InteriorLoad,
  'startPressure' | 'ignitionPressure' | 'barrel' | 'bullet' | 'resistance'
>

/** The engraving pressure at travel 0 and the bore resistance there, the friction plus that pressure. */
function resistanceAtStart(resistance: AdvisoryLoad['resistance']) {
  const first = resistance?.engraving?.[0]
  const engraving = first !== undefined && first.travel === 0 ? first.pressure : 0
  return { engraving, floor: (resistance?.friction ?? 0) + engraving }
}

/** The rules that fire for `load`: a start pressure at or below the bore resistance at travel 0 (0 counts as not given), a radius of gyration with a twist of 0, and a start pressure above that resistance and the ignition pressure (else the shot starts at once) with an engraving pressure at travel 0 above 0; reads the load and changes nothing. */
export function interiorAdvisories(load: AdvisoryLoad): AdvisoryRule[] {
  const { startPressure, ignitionPressure, barrel, bullet } = load
  const { engraving, floor } = resistanceAtStart(load.resistance)
  const rules: [AdvisoryId, boolean][] = [
    ['startPressureBelowResistance', startPressure > 0 && startPressure <= floor],
    ['gyrationRadiusWithoutTwist', bullet.gyrationRadius !== undefined && !(barrel.twist > 0)],
    [
      'startPressureHeldOnce',
      startPressure > floor && startPressure > ignitionPressure && engraving > 0,
    ],
  ]
  return rules.flatMap(([id, fires]) => (fires ? [advisoryRule[id]] : []))
}
