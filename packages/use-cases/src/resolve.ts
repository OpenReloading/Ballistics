/** Database records to model inputs, with exact unit conversions. */

import type { Aerodynamics, Projectile } from '@rangefoundry/ballistics'
import type { Catalogue, Catalogued } from '@rangefoundry/catalog'
import { type Bullet, toSi } from '@rangefoundry/schema'
import { type ResolvedRecord, resolvedRecord } from './answer.ts'
import { InputError, RecordNotFound } from './issue.ts'
import type { CartridgeWithSpecs } from './limits.ts'

/** `record`, or a `RecordNotFound` naming the `kind` and `id` that were not found. */
function found<T>(record: T | undefined, kind: string, id: string): T {
  if (!record) throw new RecordNotFound(kind, id)
  return record
}

/** The cartridge record `id` with its values; a 404 error when unknown. */
export const findCartridge = (catalogue: Catalogue, id: string): CartridgeWithSpecs =>
  found(catalogue.get('cartridge', id), 'cartridge', id)

/** The bullet record `id`; a 404 error when unknown. */
export const findBullet = (catalogue: Catalogue, id: string): Catalogued<'bullet'> =>
  found(catalogue.get('bullet', id), 'bullet', id)

/** The powder record `id`; a 404 error when unknown. */
export const findPowder = (catalogue: Catalogue, id: string): Catalogued<'powder'> =>
  found(catalogue.get('powder', id), 'powder', id)

/** Record values in SI: mass kg, diameter and length m, each absent where the record has none. */
export function bulletSi(record: Bullet): {
  mass: number
  diameter: number | undefined
  length: number | undefined
} {
  return {
    mass: toSi('mass', record.mass.value),
    diameter: record.diameter && toSi('length', record.diameter.value),
    length: record.length && toSi('length', record.length.value),
  }
}

/** Result of {@link bulletProjectile}: the projectile and the `resolved.bullet` part. */
export interface BulletProjectile {
  projectile: Projectile
  bullet: ResolvedRecord & { dragModel: 'G1' | 'G7' }
}

/**
 * Projectile from a bullet record: the BCs of `dragModel` become bands (lb/in2 to kg/m2, a band
 * without `minVelocity` starts at 0). Throws InputError when the record has no BC of that model or
 * two of its BCs share a start speed.
 */
export function bulletProjectile(
  record: Bullet,
  ref: {
    dragModel: 'G1' | 'G7'
    length?: number | undefined
    aerodynamics?: Aerodynamics | undefined
  },
): BulletProjectile {
  const bands = (record.ballisticCoefficients ?? [])
    .filter((c) => c.dragModel === ref.dragModel)
    .map((c) => ({
      ballisticCoefficient: toSi('ballisticCoefficient', c.value),
      minVelocity: c.minVelocity?.value ?? 0,
    }))
  if (bands.length === 0)
    throw new InputError({
      code: 'bulletWithoutCoefficient',
      params: { bullet: record.id, model: ref.dragModel },
    })
  // records can list alternative BCs (tip, test range) that are not velocity bands
  if (new Set(bands.map((b) => b.minVelocity)).size < bands.length)
    throw new InputError({
      code: 'bulletCoefficientsWithoutBands',
      params: { bullet: record.id, count: bands.length, model: ref.dragModel },
    })
  const si = bulletSi(record)
  if (si.diameter === undefined)
    throw new InputError({ code: 'bulletWithoutDiameter', params: { bullet: record.id } })
  const length = ref.length ?? si.length
  const projectile: Projectile = {
    mass: si.mass,
    diameter: si.diameter,
    ...(length !== undefined && { length }),
    drag: { kind: 'bc', model: ref.dragModel, bands },
    ...(ref.aerodynamics && { aerodynamics: ref.aerodynamics }),
  }
  const fields = ['mass', 'diameter']
  if (ref.length === undefined && si.length !== undefined) fields.push('length')
  fields.push('ballisticCoefficients')
  return { projectile, bullet: { ...resolvedRecord(record, fields), dragModel: ref.dragModel } }
}
