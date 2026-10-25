import { InputError } from '../errors.ts'
import { boreArea } from './bore-resistance.ts'
import type { InteriorLoad } from './model.ts'
import { burnFormKeys } from './workbench-keys.ts'

/**
 * The M3 load of a workbench load file (`apps/docs/docs/models/interior-m3.md`, "Load file"): SI values per field key to
 * `InteriorLoad`. The workbench and `POST /interior/load-file` use this one mapping.
 */

/** An `InputError` about the value of one field; `field` is its key. */
export class ValueError extends InputError {
  field: string
  constructor(field: string, message: string) {
    super(message)
    this.field = field
  }
}

/** The keys `interiorLoad` needs: no other value or record gives them (the bore area is optional). */
const requiredKeys = [
  'volume',
  'boreDiameter',
  'travel',
  'twist',
  'bulletMass',
  'charge',
  'propellantEnergy',
  'gamma',
  'density',
  'covolume',
  'vivacity',
  'exponent',
  'referencePressure',
  'propellantTemperature',
  'ignitionPressure',
  'startPressure',
] as const

/** Every key `interiorLoad` needs that `values` lacks or holds as a non-finite number, in the order of the workbench. */
export const missingLoadKeys = (values: Record<string, number | undefined>): string[] =>
  requiredKeys.filter((key) => !Number.isFinite(values[key]))

/**
 * `InteriorLoad` from SI field values. An empty bore area is the circle of the mean of the bore
 * diameter and `grooveDiameter` (m) where given, else of the bore diameter (`boreArea`; a rifled
 * bore is larger, so the field exists). `label` names a field in an error.
 * Throws `ValueError` for a missing required value or a partly filled burn form.
 */
export function interiorLoad(
  values: Record<string, number | undefined>,
  label: (key: string) => string = (key) => key,
  grooveDiameter?: number,
): InteriorLoad {
  const v = (key: string) => {
    const x = values[key]
    if (x === undefined || !Number.isFinite(x))
      throw new ValueError(key, `Enter a number for ${label(key)}.`)
    return x
  }
  const boreDiameter = v('boreDiameter')
  // 0 is a leak that never opens: the solver takes it
  const leakArea = values.leakArea === undefined ? undefined : v('leakArea')
  if (leakArea !== undefined && leakArea < 0)
    throw new ValueError('leakArea', `${label('leakArea')} must be at least 0.`)
  const form = Object.entries(burnFormKeys).filter(([k]) => values[k] !== undefined)
  if (form.length > 0 && form.length < 4) {
    const missing = Object.entries(burnFormKeys).filter(([k]) => values[k] === undefined)
    throw new ValueError(
      missing[0][0],
      `Burn form: ${missing.map(([, n]) => n).join(', ')} needed with the others, or leave all four empty.`,
    )
  }
  return {
    chamber: {
      volume: v('volume'),
      boreArea: boreArea({ area: values.boreArea, boreDiameter, grooveDiameter }),
      boreDiameter,
    },
    barrel: { length: v('travel'), twist: v('twist') },
    bullet: { mass: v('bulletMass') },
    charge: v('charge'),
    propellant: {
      specificEnergy: v('propellantEnergy'),
      gamma: v('gamma'),
      density: v('density'),
      covolume: v('covolume'),
      burn: {
        kind: 'vivacity',
        vivacity: v('vivacity'),
        exponent: v('exponent'),
        referencePressure: v('referencePressure'),
        form:
          form.length === 4
            ? { kind: 'twoStage', a: v('formA'), m: v('formM'), q: v('formQ'), z1: v('formZ1') }
            : { kind: 'constant' },
      },
    },
    propellantTemperature: v('propellantTemperature'),
    ignitionPressure: v('ignitionPressure'),
    startPressure: v('startPressure'),
    ...(values.sebert !== undefined && {
      gradient: { energy: v('sebert'), breech: v('sebert') },
    }),
    // a leak area constant over the whole travel (`apps/docs/docs/models/interior-leakage-heat.md`)
    ...(leakArea !== undefined && {
      leakage: {
        area: [
          { travel: 0, area: leakArea },
          { travel: v('travel'), area: leakArea },
        ],
      },
    }),
  }
}

/**
 * Throws `ValueError` for an override of the bore resistance outside what the solver takes: a
 * `boreFriction` or `engravingPressure` below 0, an `engravingLength` of 0 or below (the ramp's
 * travels must increase), or a value that is not a number. Needs no powder record.
 */
export function checkResistanceValues(values: Record<string, number | undefined>): void {
  for (const [key, min] of [
    ['boreFriction', 0],
    ['engravingPressure', 0],
    ['engravingLength', 0],
  ] as const) {
    const x = values[key]
    if (x === undefined) continue
    if (!Number.isFinite(x)) throw new ValueError(key, 'Enter a number.')
    if (key === 'engravingLength' ? x <= min : x < min)
      throw new ValueError(
        key,
        key === 'engravingLength' ? 'Must be above 0.' : 'Must be at least 0.',
      )
  }
}

/**
 * The bore resistance of a run: the powder record's (`recordResistance`) with the terms the load
 * file overrides (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"). `boreFriction` replaces the friction
 * pressure; `engravingPressure` and `engravingLength` replace the start and the length of the
 * engraving ramp, the other of the two staying the record's. No override: `record` itself.
 * Throws `ValueError` for one engraving value with no engraving to complete it.
 */
export function overrideResistance(
  record: InteriorLoad['resistance'],
  values: Record<string, number | undefined>,
): InteriorLoad['resistance'] {
  checkResistanceValues(values)
  const { boreFriction, engravingPressure, engravingLength } = values
  const ramp = engravingPressure !== undefined || engravingLength !== undefined
  if (boreFriction === undefined && !ramp) return record
  let engraving = record?.engraving
  if (ramp) {
    const pressure = engravingPressure ?? engraving?.[0]?.pressure
    const length = engravingLength ?? engraving?.at(-1)?.travel
    const needed = 'Needed with the other engraving value, or from a powder record.'
    if (pressure === undefined) throw new ValueError('engravingPressure', needed)
    if (length === undefined) throw new ValueError('engravingLength', needed)
    engraving = [
      { travel: 0, pressure },
      { travel: length, pressure: 0 },
    ]
  }
  const friction = boreFriction ?? record?.friction
  return { ...(friction !== undefined && { friction }), ...(engraving && { engraving }) }
}

/** Charge bulk volume over the free volume behind the seated bullet; charge kg, bulk density kg/m³, volume m³. */
export function loadRatio(charge: number, bulkDensity: number | undefined, volume: number) {
  if (!bulkDensity || !(volume > 0)) return
  return charge / bulkDensity / volume
}

/**
 * Solid fill, charge solid volume over the chamber volume behind the seated bullet, above which a
 * load is outside the range the interior model was built for (`apps/docs/docs/models/interior-m3.md`, "Load file").
 */
export const solidFillLimit = 0.64

/** Charge solid volume over the chamber volume; charge kg, solid density kg/m³, volume m³. */
export const solidFill = (charge: number, density: number, volume: number) =>
  charge / (density * volume)

/** The load ratio at `solidFillLimit`; solid and bulk density kg/m³. */
export const fillLoadRatioLimit = (density: number, bulkDensity: number) =>
  (solidFillLimit * density) / bulkDensity
