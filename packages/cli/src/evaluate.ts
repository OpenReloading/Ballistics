import {
  InputError,
  type InteriorLoad,
  type interior,
  recordLoad,
  ValueError,
  waterDensityGramsPerCm3,
} from '@open-reloading/core'
import { bulletDimensions } from '@open-reloading/drawing/bullet'
import { chamberOf, seat } from '@open-reloading/drawing/seating'
import type { Bullet, Cartridge } from '@open-reloading/schema'
import { loadWaterCapacity, toSi } from '@open-reloading/schema'
import type { Records } from './records.ts'
import type { Row } from './rows.ts'
import { type Split, splitOf } from './split.ts'

/** The interior model a run calls: the signature of `interior` of core. */
export type InteriorModel = typeof interior

/** Why a row is not used in the metrics. */
export const reasons = [
  'unknownCartridge',
  'unknownBullet',
  'unknownPowder',
  'noPowderModel',
  'noCaseCapacity',
  'noBulletLength',
  'noBulletShape',
  'noBarrelLength',
  'missingCartridgeValue',
  'modelRefused',
] as const

/** One of {@link reasons}. */
type Reason = (typeof reasons)[number]

/** The model's muzzle velocity (m/s) and peak breech pressure (Pa) for a row, or why there is none. */
export type Prediction = { velocity: number; pressure: number } | { reason: Reason }

/** A row with its split, its powder's family and what the model gave. */
export interface Outcome {
  row: Row
  split: Split
  family: string
  /** Structure of the bullet record, else `<core material>-core`, else `unspecified`; `unknown` without a record. */
  construction: string
  prediction: Prediction
}

/** The powder family: propellant base and grain form of the record, `unspecified` where it has none. */
export const familyOf = (
  powder: { propellantBase?: string | undefined; grainForm?: string | undefined } | undefined,
) =>
  powder
    ? `${powder.propellantBase ?? 'unspecified'}/${powder.grainForm ?? 'unspecified'}`
    : 'unknown'

/** The construction of a bullet record, for grouping. */
export const constructionOf = (bullet: Bullet | undefined) => {
  if (!bullet) return 'unknown'
  const { structure, core } = bullet.construction ?? {}
  return structure ?? (core?.material ? `${core.material}-core` : 'unspecified')
}

/** The volume behind the seated bullet (m3) and the bullet travel (m) of a row, or why they are not known. */
function seated(
  row: Row,
  cartridge: Cartridge,
  bullet: Bullet,
  records: Records,
): { volume: number; travel: number } | Reason {
  const water = loadWaterCapacity({
    capacity: records.capacities.get(row.cartridge),
    case: records.cases.get(row.cartridge),
  })
  const chamber = chamberOf(cartridge.values)
  const dimensions = bulletDimensions(bullet)
  const coal = row.coal ?? chamber?.cartridgeL6
  if (!water) return 'noCaseCapacity'
  if (!dimensions) return 'noBulletLength'
  if (row.barrel === undefined) return 'noBarrelLength'
  if (!chamber || coal === undefined) return 'missingCartridgeValue'
  try {
    const s = seat({
      bullet: dimensions,
      chamber,
      waterCapacity: water.grams,
      waterDensity: waterDensityGramsPerCm3,
      barrelLength: row.barrel,
      by: { kind: 'overallLength', value: coal },
    })
    if (!s.volumeBehindBullet || !s.travel) return 'noCaseCapacity'
    return {
      volume: toSi('volume', s.volumeBehindBullet.value),
      travel: toSi('length', s.travel.value),
    }
  } catch (error) {
    if (error instanceof RangeError) return 'noBulletShape'
    throw error
  }
}

/** The load of a row from its records, or why it cannot be built. */
function loadOf(row: Row, records: Records): InteriorLoad | Reason {
  const cartridge = records.cartridges.get(row.cartridge)
  const bullet = records.bullets.get(row.bullet)
  const powder = records.powders.get(row.powder)
  if (!cartridge) return 'unknownCartridge'
  if (!bullet) return 'unknownBullet'
  if (!powder) return 'unknownPowder'
  if (!powder.interior) return 'noPowderModel'
  const geometry = seated(row, cartridge, bullet, records)
  if (typeof geometry === 'string') return geometry
  try {
    return recordLoad({
      cartridge,
      powder,
      bullet: { mass: toSi('mass', bullet.mass.value), lengthMm: bullet.length?.value },
      charge: toSi('mass', row.charge),
      ...geometry,
      ...(row.temperature !== undefined && { temperature: toSi('temperature', row.temperature) }),
    })
  } catch (error) {
    if (error instanceof ValueError) return 'missingCartridgeValue'
    if (error instanceof InputError) return 'modelRefused'
    throw error
  }
}

/** The prediction of `model` for one row. */
export function predict(row: Row, records: Records, model: InteriorModel): Prediction {
  const load = loadOf(row, records)
  if (typeof load === 'string') return { reason: load }
  try {
    const result = model(load)
    // a velocity or pressure that is not a finite number would turn every statistic into null, and
    // a velocity at or below 0 would make the interval distance negative (inside every interval)
    if (
      !result.valid ||
      !Number.isFinite(result.muzzleVelocity) ||
      result.muzzleVelocity <= 0 ||
      !Number.isFinite(result.peakBreechPressure)
    )
      return { reason: 'modelRefused' }
    return { velocity: result.muzzleVelocity, pressure: result.peakBreechPressure }
  } catch (error) {
    if (error instanceof InputError) return { reason: 'modelRefused' }
    throw error
  }
}

/** The outcome of each row of the splits in `wanted`; other rows are left out. */
export function outcomes(
  rows: readonly Row[],
  records: Records,
  model: InteriorModel,
  wanted: readonly Split[],
): Outcome[] {
  return rows.flatMap((row) => {
    const split = splitOf(row.cartridge)
    if (!wanted.includes(split)) return []
    const family = familyOf(records.powders.get(row.powder))
    const construction = constructionOf(records.bullets.get(row.bullet))
    return [{ row, split, family, construction, prediction: predict(row, records, model) }]
  })
}
