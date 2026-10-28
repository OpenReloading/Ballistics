/**
 * The advisory registry: every rule that tells a user something about a run (`apps/docs/docs/models/interior-m3.md`,
 * "Advisories"). An `error` blocks a run; a `warn` or `info` never changes a result. A message states facts about the
 * inputs and the model only, never a statement about the load.
 */
import { chargeTooSmallRatio, type InteriorLoad } from './interior/model.ts'

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
  /** Short name for a summary line. */
  name: string
  /** What holds, as a fact about the inputs or the model. A message built from values states those values too. */
  message: string
  /** What changes the situation. */
  fix: string
}

/** The rules, in the order the API lists its warning codes. */
export const advisoryRules: readonly AdvisoryRule[] = [
  {
    id: 'limitExceeded',
    severity: 'warn',
    inputs: ['cartridge'],
    name: 'limit exceeded',
    message: 'The simulated peak pressure is above a CIP maximum pressure of the cartridge.',
    fix: 'Change the inputs that set the simulated pressure, or compare with another cartridge record.',
  },
  {
    id: 'noCartridge',
    severity: 'info',
    inputs: ['cartridge'],
    name: 'no cartridge',
    message: 'No cartridge id was given, so no CIP Pmax was checked.',
    fix: 'Give a cartridge id.',
  },
  {
    id: 'noComparableLimit',
    severity: 'info',
    inputs: ['cartridge'],
    name: 'no comparable limit',
    message: 'The cartridge has no CIP Pmax measured by transducer or piezo.',
    fix: 'Use a cartridge record with such a value.',
  },
  {
    id: 'rangeIncomplete',
    severity: 'warn',
    inputs: ['tolerances'],
    name: 'range incomplete',
    message: 'Some cases of the pressure range could not be computed.',
    fix: 'Narrow the tolerances or change the inputs named by the failed cases.',
  },
  {
    id: 'chargeTooSmall',
    severity: 'warn',
    inputs: ['charge', 'startPressure', 'ignitionPressure'],
    name: 'charge too small for the model',
    message: `The simulated peak mean pressure is below ${chargeTooSmallRatio} times the hold pressure; the results are outside the range the model was built for.`,
    fix: 'Change the charge, the start pressure or the ignition pressure.',
  },
  {
    id: 'resistanceNotApplied',
    severity: 'warn',
    inputs: ['resistance'],
    name: 'resistance not applied',
    message:
      'The powder parameters were fitted with a bore-resistance law this run cannot apply; the results are biased.',
    fix: 'Give the values the law needs.',
  },
  {
    id: 'loadRatioHigh',
    severity: 'warn',
    inputs: ['charge', 'chamber.volume', 'propellant.density'],
    name: 'solid fill high',
    message:
      'The solid fill is above the limit of the model; the model is outside the range it was built for.',
    fix: 'Change the charge or the chamber volume.',
  },
  {
    id: 'startPressureBelowResistance',
    severity: 'warn',
    inputs: ['startPressure', 'resistance.friction', 'resistance.engraving'],
    name: 'start pressure has no effect',
    message:
      'The start pressure is at or below the bore resistance at travel 0, so the shot starts when the pressure force exceeds that resistance and the start pressure has no effect.',
    fix: 'Set a start pressure above the bore resistance at travel 0, or remove the start pressure.',
  },
  {
    id: 'gyrationRadiusWithoutTwist',
    severity: 'warn',
    inputs: ['bullet.gyrationRadius', 'barrel.twist'],
    name: 'gyration radius ignored',
    message:
      'The twist is 0, so the bullet has no rotational energy and the radius of gyration is ignored.',
    fix: 'Give a twist above 0, or remove the radius of gyration.',
  },
  {
    id: 'startPressureHeldOnce',
    severity: 'info',
    inputs: ['startPressure', 'resistance.engraving'],
    name: 'start pressure held once',
    message:
      'The start pressure is above the bore resistance at travel 0 and the engraving pressure at travel 0 is not 0, so the projectile is held until the start pressure and then resisted at the lower bore resistance.',
    fix: 'Set the start pressure to the bore resistance at travel 0 or below, or the engraving pressure at travel 0 to 0.',
  },
]

/** Every code of the registry, in registry order. */
export const advisoryIds = advisoryRules.map((r) => r.id) as [AdvisoryId, ...AdvisoryId[]]

/** The rule of each code. */
// invariant: built from every rule of the array, so it has exactly the keys of AdvisoryId (a test pins it)
export const advisoryRule = Object.fromEntries(
  advisoryRules.map((r) => [r.id, r]),
) as unknown as Readonly<Record<AdvisoryId, AdvisoryRule>>

/** The inputs of an interior load that the input rules read. */
export type AdvisoryLoad = Pick<InteriorLoad, 'startPressure' | 'barrel' | 'bullet' | 'resistance'>

/**
 * The input rules that fire for `load`: a start pressure at or below the bore resistance at travel 0
 * (the friction plus the engraving pressure there; a start pressure of 0 counts as not given), a
 * radius of gyration with a twist of 0, and a start pressure above that resistance with an engraving
 * pressure at travel 0 that is not 0. Reads the load and changes nothing.
 */
export function interiorAdvisories(load: AdvisoryLoad): AdvisoryRule[] {
  const { startPressure, barrel, bullet, resistance } = load
  const first = resistance?.engraving?.[0]
  const engraving = first !== undefined && first.travel === 0 ? first.pressure : 0
  const floor = (resistance?.friction ?? 0) + engraving
  const fired: AdvisoryId[] = []
  if (startPressure > 0 && startPressure <= floor) fired.push('startPressureBelowResistance')
  if (bullet.gyrationRadius !== undefined && !(barrel.twist > 0))
    fired.push('gyrationRadiusWithoutTwist')
  if (startPressure > floor && engraving > 0) fired.push('startPressureHeldOnce')
  return fired.map((id) => advisoryRule[id])
}
