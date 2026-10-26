/** Database records to core inputs, with exact unit conversions. */
import { httpErrors } from '@fastify/sensible'
import { type Aerodynamics, InputError, type Projectile } from '@open-reloading/core'
import { type Bullet, toSi } from '@open-reloading/schema'
import type { Catalogue } from '../catalogue/types.ts'
import { type ResolvedRecord, resolvedRecord } from './answer.ts'
import type { CartridgeWithSpecs } from './limits.ts'

/** `record`, or a 404 error naming the `kind` and `id` that were not found. */
function found<T>(record: T | undefined, kind: string, id: string): T {
  if (!record) throw httpErrors.notFound(`${kind} ${id} not found`)
  return record
}

/** The cartridge record `id` with its values; a 404 error when unknown. */
export const findCartridge = (catalogue: Catalogue, id: string): CartridgeWithSpecs =>
  found(catalogue.get('cartridge', id), 'cartridge', id)

/** The bullet record `id`; a 404 error when unknown. */
export const findBullet = (catalogue: Catalogue, id: string) =>
  found(catalogue.get('bullet', id), 'bullet', id)

/** The powder record `id`; a 404 error when unknown. */
export const findPowder = (catalogue: Catalogue, id: string) =>
  found(catalogue.get('powder', id), 'powder', id)

/** Record values in SI: mass kg, diameter and length m. */
export function bulletSi(record: Bullet) {
  return {
    mass: toSi('mass', record.mass.value),
    diameter: toSi('length', record.diameter.value),
    length: record.length && toSi('length', record.length.value),
  }
}

/** Result of {@link bulletProjectile}: the projectile and the `resolved.bullet` part. */
interface BulletProjectile {
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
    throw new InputError(`bullet ${record.id} has no ${ref.dragModel} ballistic coefficient`)
  // records can list alternative BCs (tip, test range) that are not velocity bands
  if (new Set(bands.map((b) => b.minVelocity)).size < bands.length)
    throw new InputError(
      `bullet ${record.id} has ${bands.length} ${ref.dragModel} values without distinct velocity bands; send drag explicitly`,
    )
  const si = bulletSi(record)
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
