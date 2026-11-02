/**
 * Default shot-start pressure of M3 (`apps/docs/docs/models/interior-m3.md`, "Shot start") when the load gives
 * none. Approximate: effective values of the load-table fit, not measurements of a bullet.
 */
import { need } from '../errors.ts'

/** A default shot-start pressure with its interval and source. */
export interface StartPressureDefault {
  /** Shot-start pressure, Pa. */
  value: number
  /** 95 % interval, Pa; absent for an assumption. */
  interval?: [number, number]
  approximate: true
  source: string
}

/** Bullet construction read from the bullet type: cast or coated lead, plated, jacketed, solid. */
export type BulletConstruction = 'lead' | 'plated' | 'jacketed' | 'monolithic'

/** Barrel length below which a load counts as a handgun load, m. */
export const handgunBarrelLengthLimit = 0.3

const rifle: StartPressureDefault = {
  value: 30e6,
  approximate: true,
  source:
    'assumption, not fitted (apps/docs/docs/models/interior-m3.md, "Shot start"): the value before the study; on the rifle validation rows of the load-table fit the fitted rules (one value, by construction, by construction and class) stayed within 0.1 percentage points of it',
}

const handgunSource =
  'fitted to the handgun training rows of this construction in the load-table fit (one value per construction and class; apps/docs/docs/models/interior-m3.md, "Shot start"); interval: cartridge bootstrap with the powder parameters held, a lower bound'

const handgun = (value: number, low: number, high: number): StartPressureDefault => ({
  value: value * 1e6,
  interval: [low * 1e6, high * 1e6],
  approximate: true,
  source: handgunSource,
})

const rifleSource =
  'fitted to the rifle training rows of this construction in the load-table fit (one value per construction and class; apps/docs/docs/models/interior-m3.md, "Shot start"); interval: cartridge bootstrap with the powder parameters held, a lower bound'

const rifleFit = (value: number, low: number, high: number): StartPressureDefault => ({
  value: value * 1e6,
  interval: [low * 1e6, high * 1e6],
  approximate: true,
  source: rifleSource,
})

/** The fitted rifle values: plated has no rifle rows, it takes the rifle assumption. */
const rifles: Partial<Record<BulletConstruction, StartPressureDefault>> = {
  jacketed: rifleFit(29.2, 27.5, 31.3),
  lead: rifleFit(30.0, 24.5, 40.3),
  monolithic: rifleFit(35.3, 33.0, 37.9),
}

const handguns: Record<BulletConstruction, StartPressureDefault> = {
  jacketed: handgun(30.8, 21.2, 40.6),
  lead: handgun(24.3, 16.7, 34.2),
  plated: handgun(30.9, 13.2, 37.7),
  monolithic: handgun(50.0, 33.8, 65.3),
}

/**
 * Default start pressure for a barrel length in m and the bullet construction: the fitted value of
 * the construction and the firearm class (a barrel under `handgunBarrelLengthLimit` is a handgun). A
 * handgun without a construction counts as jacketed; a rifle without one, and a rifle plated bullet
 * (no rifle rows), takes the rifle assumption. Throws `InputError` for a barrel that is not a
 * positive number and for an unknown construction.
 */
export function defaultStartPressure(
  barrel: number,
  construction?: BulletConstruction,
): StartPressureDefault {
  need(Number.isFinite(barrel) && barrel > 0, `barrel ${barrel} m must be a positive number`)
  need(
    construction === undefined || Object.hasOwn(handguns, construction),
    `unknown bullet construction ${construction}`,
  )
  if (barrel < handgunBarrelLengthLimit) return handguns[construction ?? 'jacketed']
  return (construction && rifles[construction]) || rifle
}

/** The part of a bullet record's `construction` that the start pressure reads. */
export interface StructureFields {
  structure?: string | undefined
}

/** `construction.structure` of a bullet record by core construction; a frangible bullet is not listed. */
const constructions: Record<string, BulletConstruction> = {
  cast: 'lead',
  swaged: 'lead',
  plated: 'plated',
  'cup-and-core': 'jacketed',
  bonded: 'jacketed',
  partitioned: 'jacketed',
  monolithic: 'monolithic',
}

/**
 * The construction of a bullet record's `construction`: cast and swaged are lead, plated is plated,
 * cup-and-core, bonded and partitioned are jacketed, monolithic is monolithic. A frangible bullet
 * and a construction without a structure count as jacketed, `assumed`. Undefined where the record
 * gives no construction at all.
 */
export function constructionOf(
  fields: StructureFields | undefined,
): { construction: BulletConstruction; assumed: boolean } | undefined {
  if (!fields) return undefined
  const mapped =
    fields.structure !== undefined && Object.hasOwn(constructions, fields.structure)
      ? constructions[fields.structure]
      : undefined
  return { construction: mapped ?? 'jacketed', assumed: mapped === undefined }
}

/** A start pressure rule with the construction it read, `assumed` where the record did not state one. */
export interface StartPressureRule extends StartPressureDefault {
  construction?: BulletConstruction
  assumed?: true
}

/**
 * The default start pressure for a barrel length in m and a bullet's `construction` record: the
 * value of its construction and firearm class. Without a barrel length or a construction it is the
 * rifle assumption.
 */
export function startPressureOf(
  barrel: number | undefined,
  fields: StructureFields | undefined,
): StartPressureRule {
  const found = constructionOf(fields)
  if (!found || barrel === undefined || !(barrel > 0))
    return defaultStartPressure(handgunBarrelLengthLimit)
  return {
    ...defaultStartPressure(barrel, found.construction),
    construction: found.construction,
    ...(found.assumed && { assumed: true as const }),
  }
}
