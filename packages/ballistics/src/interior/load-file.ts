import { InputError, nth } from '@rangefoundry/statistics'
import type { LoadFileIssue } from '../issue.ts'
import { boreArea } from './bore-resistance.ts'
import type { InteriorLoad } from './model.ts'
import { burnFormKeys } from './workbench-keys.ts'

/** SI values per field key to `InteriorLoad` (`apps/docs/docs/models/interior-m3.md`, "Load file"); the workbench and `POST /interior/load-file` use this one mapping. */

/** An `InputError` about the value of one field; `field` is its key. */
export class ValueError extends InputError {
  field: string
  constructor(field: string, issue: LoadFileIssue) {
    super(issue)
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

type FieldReader = (key: string) => number

/** A reader of the required field values: throws `ValueError` for a missing or non-finite one. */
const fieldReader =
  (values: Record<string, number | undefined>): FieldReader =>
  (key) => {
    const x = values[key]
    if (x === undefined || !Number.isFinite(x))
      throw new ValueError(key, { code: 'valueMissing', params: { field: key } })
    return x
  }

/** The leak area and the throat wear of the load file where given; throws `ValueError` for a negative one. */
function leakAndWear(
  values: Record<string, number | undefined>,
  v: FieldReader,
): { leakArea: number | undefined; wear: number } {
  // 0 is a leak that never opens: the solver takes it
  const leakArea = values['leakArea'] === undefined ? undefined : v('leakArea')
  if (leakArea !== undefined && leakArea < 0)
    throw new ValueError('leakArea', { code: 'valueNegative', params: { field: 'leakArea' } })
  // a worn throat adds its length times the bore area behind the bullet (`apps/docs/docs/models/interior-m3.md`, "Throat wear")
  const wear = values['throatWear'] === undefined ? 0 : v('throatWear')
  if (wear < 0)
    throw new ValueError('throatWear', { code: 'valueNegative', params: { field: 'throatWear' } })
  return { leakArea, wear }
}

/** Whether all four burn form fields are given; throws `ValueError` when some but not all are. */
function burnFormGiven(values: Record<string, number | undefined>): boolean {
  const form = Object.entries(burnFormKeys).filter(([k]) => values[k] !== undefined)
  if (form.length > 0 && form.length < 4) {
    const missing = Object.entries(burnFormKeys).filter(([k]) => values[k] === undefined)
    throw new ValueError(nth(missing, 0)[0], {
      code: 'burnFormPartial',
      params: { missing: missing.map(([, n]) => n) },
    })
  }
  return form.length === 4
}

/** The propellant of the load file: its constants and a vivacity law, with the two-stage form when given. */
function vivacityPropellant(v: FieldReader, twoStage: boolean): InteriorLoad['propellant'] {
  return {
    specificEnergy: v('propellantEnergy'),
    gamma: v('gamma'),
    density: v('density'),
    covolume: v('covolume'),
    burn: {
      kind: 'vivacity',
      vivacity: v('vivacity'),
      exponent: v('exponent'),
      referencePressure: v('referencePressure'),
      form: twoStage
        ? { kind: 'twoStage', a: v('formA'), m: v('formM'), q: v('formQ'), z1: v('formZ1') }
        : { kind: 'constant' },
    },
  }
}

/** The pressure gradient (Sebert) and the leakage the load file gives, as entries to spread. */
function optionalTerms(
  values: Record<string, number | undefined>,
  v: FieldReader,
  leakArea: number | undefined,
): Pick<InteriorLoad, 'gradient' | 'leakage'> {
  return {
    ...(values['sebert'] !== undefined && {
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

/** An empty bore area is the circle of the mean of the bore diameter and `grooveDiameter` (m), else of the bore diameter (`boreArea`; a rifled bore is larger, so the field exists); throws `ValueError` for a missing required value or a partly filled burn form. */
export function interiorLoad(
  values: Record<string, number | undefined>,
  grooveDiameter?: number,
): InteriorLoad {
  const v = fieldReader(values)
  const boreDiameter = v('boreDiameter')
  const { leakArea, wear } = leakAndWear(values, v)
  const twoStage = burnFormGiven(values)
  return {
    chamber: {
      volume: v('volume'),
      boreArea: boreArea({ area: values['boreArea'], boreDiameter, grooveDiameter }),
      boreDiameter,
      ...(wear > 0 && { throatWear: wear }),
    },
    barrel: { length: v('travel'), twist: v('twist') },
    bullet: { mass: v('bulletMass') },
    charge: v('charge'),
    propellant: vivacityPropellant(v, twoStage),
    propellantTemperature: v('propellantTemperature'),
    ignitionPressure: v('ignitionPressure'),
    startPressure: v('startPressure'),
    ...optionalTerms(values, v, leakArea),
  }
}

/** Throws `ValueError` for a bore-resistance override the solver cannot take: `boreFriction` or `engravingPressure` below 0, an `engravingLength` of 0 or below (the ramp's travels must increase), or a value that is not a number; needs no powder record. */
export function checkResistanceValues(values: Record<string, number | undefined>): void {
  for (const [key, min] of [
    ['boreFriction', 0],
    ['engravingPressure', 0],
    ['engravingLength', 0],
  ] as const) {
    const x = values[key]
    if (x === undefined) continue
    if (!Number.isFinite(x)) throw new ValueError(key, { code: 'valueNotNumber', params: {} })
    if (key === 'engravingLength' ? x <= min : x < min)
      throw new ValueError(key, {
        code: key === 'engravingLength' ? 'valueNotPositive' : 'valueBelowZero',
        params: {},
      })
  }
}

type Engraving = NonNullable<InteriorLoad['resistance']>['engraving']

/** The engraving ramp the load file sets: its start pressure and length, the one not given taken from the record's `engraving`; throws `ValueError` when neither gives it. */
function overriddenRamp(
  engraving: Engraving,
  { engravingPressure, engravingLength }: Record<string, number | undefined>,
): Engraving {
  const pressure = engravingPressure ?? engraving?.[0]?.pressure
  const length = engravingLength ?? engraving?.at(-1)?.travel
  const needed = { code: 'engravingValueNeeded', params: {} } as const
  if (pressure === undefined) throw new ValueError('engravingPressure', needed)
  if (length === undefined) throw new ValueError('engravingLength', needed)
  return [
    { travel: 0, pressure },
    { travel: length, pressure: 0 },
  ]
}

/** `boreFriction` replaces the friction pressure, `engravingPressure` and `engravingLength` the start and length of the ramp (the other of the two staying the record's); no override returns `record` itself; throws `ValueError` for one engraving value with no engraving to complete it (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"). */
export function overrideResistance(
  record: InteriorLoad['resistance'],
  values: Record<string, number | undefined>,
): InteriorLoad['resistance'] {
  checkResistanceValues(values)
  const { boreFriction, engravingPressure, engravingLength } = values
  const ramp = engravingPressure !== undefined || engravingLength !== undefined
  if (boreFriction === undefined && !ramp) return record
  const own: NonNullable<InteriorLoad['resistance']> = record ?? {}
  const engraving = ramp ? overriddenRamp(own.engraving, values) : own.engraving
  const friction = boreFriction ?? own.friction
  return { ...(friction !== undefined && { friction }), ...(engraving && { engraving }) }
}

/** Charge bulk volume over the free volume behind the seated bullet; charge kg, bulk density kg/m³, volume m³. */
export function loadRatio(
  charge: number,
  bulkDensity: number | undefined,
  volume: number,
): number | undefined {
  return !bulkDensity || !(volume > 0) ? undefined : charge / bulkDensity / volume
}

/** Charge solid volume over the chamber volume behind the seated bullet, above which a load is outside the range the interior model was built for (`apps/docs/docs/models/interior-m3.md`, "Load file"). */
export const solidFillLimit = 0.64

/** Charge solid volume over the chamber volume; charge kg, solid density kg/m³, volume m³. */
export const solidFill = (charge: number, density: number, volume: number): number =>
  charge / (density * volume)

/** The load ratio at `solidFillLimit`; solid and bulk density kg/m³. */
export const fillLoadRatioLimit = (density: number, bulkDensity: number): number =>
  (solidFillLimit * density) / bulkDensity
