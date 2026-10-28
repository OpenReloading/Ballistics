import { millerStability, type Projectile } from '@open-reloading/core'
import { type Bullet, toSi } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import type { FieldRow } from './record-fields.ts'
import { metersPerFoot, pascalsPerInHg } from './units.ts'

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
