import { millerStability, type Projectile } from '@open-reloading/ballistics'
import { type Bullet, baseTypes, fromSi, toSi } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import type { FieldRow } from './record-fields.ts'
import { metersPerFoot, pascalsPerInHg } from './units.ts'

/** The bullet values a load may type over its record, by the keys of `analysis.overrides`. */
const bulletValueKeys = [
  'bulletMass',
  'bulletDiameter',
  'bulletLength',
  'bulletBcG1',
  'bulletBcG7',
  'bulletBaseLength',
  'bulletBaseDiameter',
  'bulletCavityDiameter',
  'bulletCavityDepth',
] as const
export type BulletValueKey = (typeof bulletValueKeys)[number]

/** Bullet values in SI (kg, m, kg/m2); an absent key is a value the record does not give or nobody typed. */
export type BulletValues = Partial<Record<BulletValueKey, number | undefined>>

/** A base form of a bullet, the choice of the Bullet card (`analysis.bulletBase`). */
export type BaseType = NonNullable<NonNullable<Bullet['base']>['type']>

/** The key of the typed base form among the typed Bullet card fields: its text is the form. */
export const baseTypeKey = 'bulletBase'

/** The typed base form of `typed`, none for an empty or unknown text. */
export const typedBaseType = (typed: Record<string, { text: string }>): BaseType | undefined =>
  baseTypes.safeParse(typed[baseTypeKey]?.text).data

/** The record's base dimensions, by the key of the typed value and the field of the record's `base`. */
const baseDimensions = {
  bulletBaseLength: 'length',
  bulletBaseDiameter: 'diameter',
  bulletCavityDiameter: 'cavityDiameter',
  bulletCavityDepth: 'cavityDepth',
} as const

/** The keys of the typed base dimensions. */
export const baseDimensionKeys: readonly string[] = Object.keys(baseDimensions)

/** The base forms that have a boat tail (with a base face diameter), and those with a cavity. */
export const boatTailed = (type: BaseType | undefined) => type !== undefined && type !== 'flat'
export const hollowBased = (type: BaseType | undefined) =>
  type === 'conical-hollow-base' || type === 'rounded-hollow-base'

const bcKeys = { G1: 'bulletBcG1', G7: 'bulletBcG7' } as const

/** The BCs of a drag model the record lists. */
const bandsOf = (record: Partial<Bullet>, model: 'G1' | 'G7') =>
  (record.ballisticCoefficients ?? []).filter((c) => c.dragModel === model)

/** How many BCs of `model` the record lists: several are bands that one typed value replaces. */
export const bandCount = (record: Partial<Bullet> | undefined, model: 'G1' | 'G7') =>
  record ? bandsOf(record, model).length : 0

/** SI; a BC only where the record has one value of the model: several bands have no single value to show. */
export function recordBulletValues(record: Partial<Bullet> | undefined): BulletValues {
  if (!record) return {}
  const out: BulletValues = {}
  if (record.mass) out.bulletMass = toSi('mass', record.mass.value)
  if (record.diameter) out.bulletDiameter = toSi('length', record.diameter.value)
  if (record.length) out.bulletLength = toSi('length', record.length.value)
  for (const [key, field] of Object.entries(baseDimensions)) {
    const stored = record.base?.[field]
    if (stored) out[key as keyof typeof baseDimensions] = toSi('length', stored.value)
  }
  for (const model of ['G1', 'G7'] as const) {
    const [only, ...more] = bandsOf(record, model)
    if (only && more.length === 0) out[bcKeys[model]] = toSi('ballisticCoefficient', only.value)
  }
  return out
}

/** Record, then the Bullet mass field, then typed values: the one source of every reader. */
export function effectiveBulletValues(
  record: Partial<Bullet> | undefined,
  mass: number | undefined,
  typed: Record<string, { si: number | undefined }>,
): BulletValues {
  const out: BulletValues = recordBulletValues(record)
  if (mass !== undefined) out.bulletMass = mass
  for (const key of bulletValueKeys) {
    const si = typed[key]?.si
    // a value the field refuses (0 or less) leaves the record's value in force
    if (si !== undefined && si > 0) out[key] = si
  }
  return out
}

/** The bullet diameter of `values`, mm, as the record stores it. */
export const diameterMm = (values: BulletValues) =>
  values.bulletDiameter === undefined ? undefined : fromSi('length', values.bulletDiameter)

/** Whether two SI values are one number but for a unit round trip. */
const sameValue = (a: number, b: number | undefined) =>
  b !== undefined && Math.abs(a - b) <= 1e-9 * Math.abs(b)

/** The one place a record meets typed values; a typed BC replaces all bands of its model with one from 0 m/s, a typed boat tail drops the bearing length. */
export function typedBullet<B extends Partial<Bullet>>(
  record: B,
  typed: BulletValues,
  baseType?: BaseType,
): B {
  const own = recordBulletValues(record)
  const out: Partial<Bullet> = { ...record }
  // a value equal to the record's stays the record's: no round trip through SI
  const changed = (key: BulletValueKey) => {
    const si = typed[key]
    return si !== undefined && !sameValue(si, own[key]) ? si : undefined
  }
  const [mass, diameter, length] = [
    changed('bulletMass'),
    changed('bulletDiameter'),
    changed('bulletLength'),
  ]
  if (mass !== undefined) out.mass = { value: fromSi('mass', mass) }
  if (diameter !== undefined) out.diameter = { value: fromSi('length', diameter) }
  if (length !== undefined) out.length = { value: fromSi('length', length) }
  for (const model of ['G1', 'G7'] as const) {
    const si = changed(bcKeys[model])
    if (si === undefined) continue
    out.ballisticCoefficients = [
      ...(out.ballisticCoefficients ?? []).filter((c) => c.dragModel !== model),
      { dragModel: model, value: fromSi('ballisticCoefficient', si) },
    ]
  }
  const base = typedBase(record.base, typed, baseType)
  if (base) out.base = base
  // the bearing is what the length leaves besides the nose and the boat tail: the outline derives it
  if (base && base.length?.value !== record.base?.length?.value) delete out.bearingLength
  return out as B
}

/** A form keeps only what it can have (`bulletBase`); a typed length or diameter drops the record's angle, which the outline derives. */
function typedBase(
  own: Bullet['base'],
  typed: BulletValues,
  type: BaseType | undefined,
): Bullet['base'] {
  const ownValues = recordBulletValues({ base: own })
  const base: NonNullable<Bullet['base']> = { ...own }
  let changed = false
  for (const [key, field] of Object.entries(baseDimensions)) {
    const si = typed[key as keyof typeof baseDimensions]
    if (si === undefined || sameValue(si, ownValues[key as keyof typeof baseDimensions])) continue
    base[field] = { value: fromSi('length', si) }
    changed = true
    // length, diameter and angle fix one another: the angle the record gives would contradict the typed one
    if (field !== 'cavityDiameter' && field !== 'cavityDepth') delete base.angle
  }
  if (type !== undefined && type !== own?.type) {
    base.type = type
    changed = true
  }
  if (!changed) return undefined
  if (!boatTailed(base.type)) {
    delete base.length
    delete base.diameter
    delete base.angle
  }
  if (!hollowBased(base.type)) {
    delete base.cavityDiameter
    delete base.cavityDepth
  }
  return base
}

type BallisticCoefficientChoice = {
  value: number
  minVelocity?: number | undefined
  note?: string | undefined
}

type BulletDrag =
  | { kind: 'bands'; projectile: Projectile }
  | { kind: 'choose'; values: BallisticCoefficientChoice[] }
  | { kind: 'none' }

/** By the API's rule, SI: each BC of `model` (lb/in2 to kg/m2) a band from its `minVelocity` (0 m/s when absent); several without distinct starts give `choose`, `choice` picks one. */
export function bulletDrag(record: Bullet, model: 'G1' | 'G7', choice?: number): BulletDrag {
  const bcs = (record.ballisticCoefficients ?? []).filter((c) => c.dragModel === model)
  // the trajectory needs a diameter, which a record that only names the bullet lacks
  if (bcs.length === 0 || !record.diameter) return { kind: 'none' }
  let bands = bcs.map((c) => ({
    ballisticCoefficient: toSi('ballisticCoefficient', c.value),
    minVelocity: c.minVelocity?.value ?? 0,
  }))
  if (new Set(bands.map((b) => b.minVelocity)).size < bands.length) {
    if (choice === undefined || !bcs[choice])
      return {
        kind: 'choose',
        values: bcs.map((c) => ({
          value: c.value,
          minVelocity: c.minVelocity?.value,
          note: c.note,
        })),
      }
    bands = [
      { ballisticCoefficient: toSi('ballisticCoefficient', bcs[choice].value), minVelocity: 0 },
    ]
  }
  return {
    kind: 'bands',
    projectile: {
      mass: toSi('mass', record.mass.value),
      diameter: toSi('length', record.diameter.value),
      ...(record.length && { length: toSi('length', record.length.value) }),
      drag: { kind: 'bc', model, bands },
    },
  }
}

/** Sectional density, mass over diameter squared, kg/m2. */
const sectionalDensity = (r: Pick<Bullet, 'mass' | 'diameter'>) =>
  r.diameter && toSi('mass', r.mass.value) / toSi('length', r.diameter.value) ** 2

/** Litz's recommended minimum (Litz 2015, 3rd edition; `apps/docs/docs/models/exterior-stability.md`, "Miller gyroscopic stability factor"). */
const millerStabilityTarget = 1.5

/** Twist per turn, m, for Sg `millerStabilityTarget`: at 2800 ft/s, 59 degF and 29.92 inHg Miller's corrections are 1, and Sg goes with the inverse square of the twist; undefined without a length. */
export function millerTwist(r: Pick<Bullet, 'mass' | 'diameter' | 'length'>): number | undefined {
  if (!r.length || !r.diameter) return
  const reference = 0.254
  const sg = millerStability({
    mass: toSi('mass', r.mass.value),
    diameter: toSi('length', r.diameter.value),
    length: toSi('length', r.length.value),
    twist: reference,
    velocity: 2800 * metersPerFoot,
    air: { altitude: 0, pressure: 29.92 * pascalsPerInHg, temperature: 288.15, humidity: 0 },
  })
  return reference * Math.sqrt(sg / millerStabilityTarget)
}

/** The computed rows of a bullet page, each with its method on hover. */
export function computedBulletRows(
  r: Pick<Bullet, 'mass' | 'diameter' | 'length'> & { tip?: { type: string } | undefined },
): FieldRow[] {
  const twist = millerTwist(r)
  const density = sectionalDensity(r)
  return [
    ...(density === undefined
      ? []
      : [
          {
            label: msg('Sectional density'),
            value: { quantity: 'sectionalDensity', si: density },
            method: msg('Computed: mass over diameter squared.'),
          } satisfies FieldRow,
        ]),
    ...(twist === undefined
      ? []
      : [
          {
            // the target of `millerStabilityTarget`
            label: msg('Twist for Sg 1.5'),
            value: { quantity: 'twist', si: twist },
            method:
              r.tip?.type === 'polymer-tip'
                ? msg(
                    "Computed: Miller's rule at 2800 ft/s, 59 °F, 29.92 inHg. The rule is not fitted to plastic tips.",
                  )
                : msg("Computed: Miller's rule at 2800 ft/s, 59 °F, 29.92 inHg."),
          } satisfies FieldRow,
        ]),
  ]
}
