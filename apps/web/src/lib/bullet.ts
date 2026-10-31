import { millerStability, type Projectile } from '@open-reloading/core'
import { type Bullet, fromSi, toSi } from '@open-reloading/schema'
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
] as const
export type BulletValueKey = (typeof bulletValueKeys)[number]

/** Bullet values in SI (kg, m, kg/m2); an absent key is a value the record does not give or nobody typed. */
export type BulletValues = Partial<Record<BulletValueKey, number | undefined>>

const bcKeys = { G1: 'bulletBcG1', G7: 'bulletBcG7' } as const

/** The BCs of a drag model the record lists. */
const bandsOf = (record: Partial<Bullet>, model: 'G1' | 'G7') =>
  (record.ballisticCoefficients ?? []).filter((c) => c.dragModel === model)

/** How many BCs of `model` the record lists: several are bands that one typed value replaces. */
export const bandCount = (record: Partial<Bullet> | undefined, model: 'G1' | 'G7') =>
  record ? bandsOf(record, model).length : 0

/**
 * The values a bullet record gives, SI. A BC only where the record lists one value of the model: a
 * record with several bands has no single value to show.
 */
export function recordBulletValues(record: Partial<Bullet> | undefined): BulletValues {
  if (!record) return {}
  const out: BulletValues = {}
  if (record.mass) out.bulletMass = toSi('mass', record.mass.value)
  if (record.diameter) out.bulletDiameter = toSi('length', record.diameter.value)
  if (record.length) out.bulletLength = toSi('length', record.length.value)
  for (const model of ['G1', 'G7'] as const) {
    const [only, ...more] = bandsOf(record, model)
    if (only && more.length === 0) out[bcKeys[model]] = toSi('ballisticCoefficient', only.value)
  }
  return out
}

/**
 * The bullet values a run reads: the record's, then the mass of the Bullet mass field, then the
 * typed values (`typed` holds the field values by key). The one source of every reader.
 */
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

/**
 * The one place a bullet record meets typed values: `record` with each value of `typed` in place
 * (every reader of the record's mass, diameter, length and BCs takes the result). A typed BC
 * replaces all bands of its drag model with one band from 0 m/s; the record's own single value
 * typed again leaves it as it is. The shape fields stay the record's.
 */
export function typedBullet<B extends Partial<Bullet>>(record: B, typed: BulletValues): B {
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
  return out as B
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

/**
 * Projectile from a bullet record, by the rule of the API: mass g
 * and lengths mm to SI, each BC of `model` (lb/in2) to kg/m2 as a band from its `minVelocity`
 * (0 when absent). Several BCs without distinct band starts give `choose`; `choice` then picks one
 * of them as a single band from 0 m/s. A record without a BC of `model` gives `none`.
 */
export function bulletDrag(record: Bullet, model: 'G1' | 'G7', choice?: number): BulletDrag {
  const bcs = (record.ballisticCoefficients ?? []).filter((c) => c.dragModel === model)
  if (bcs.length === 0) return { kind: 'none' }
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
  toSi('mass', r.mass.value) / toSi('length', r.diameter.value) ** 2

/**
 * Gyroscopic stability factor the Miller twist gives (Litz's recommended minimum, B. Litz, Applied
 * Ballistics for Long Range Shooting, 3rd edition, Applied Ballistics, LLC, 2015;
 * `apps/docs/docs/models/exterior-stability.md`, "Miller gyroscopic stability factor").
 */
const millerStabilityTarget = 1.5

/**
 * Twist per turn, m, at which Miller's rule gives Sg 1.5 at 2800 ft/s, 59 degF and 29.92 inHg,
 * where its velocity and atmosphere corrections are 1; undefined without a length. Sg goes with
 * the inverse square of the twist, so a reference twist scales to it.
 */
export function millerTwist(r: Pick<Bullet, 'mass' | 'diameter' | 'length'>): number | undefined {
  if (!r.length) return
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
  return [
    {
      label: msg('Sectional density'),
      value: { quantity: 'sectionalDensity', si: sectionalDensity(r) },
      method: msg('Computed: mass over diameter squared.'),
    },
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
