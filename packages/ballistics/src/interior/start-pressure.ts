/** Default shot-start pressure of M3 when the load gives none; approximate: effective values of the load-table fit, not measurements of a bullet (`apps/docs/docs/models/interior-m3.md`, "Shot start"). */
import { need } from '../issue.ts'

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

/** Barrel length in m, a handgun under `handgunBarrelLengthLimit`; a handgun without a construction counts as jacketed, a rifle without one or with a plated bullet (no rifle rows) takes the rifle assumption; throws `InputError` for a barrel that is not a positive number and for an unknown construction. */
export function defaultStartPressure(
  barrel: number,
  construction?: BulletConstruction,
): StartPressureDefault {
  need(Number.isFinite(barrel) && barrel > 0, { code: 'barrelNotPositive', params: { barrel } })
  need(construction === undefined || Object.hasOwn(handguns, construction), {
    code: 'bulletConstructionUnknown',
    params: { construction: String(construction) },
  })
  if (barrel < handgunBarrelLengthLimit) return handguns[construction ?? 'jacketed']
  return (construction && rifles[construction]) || rifle
}

/** The part of a bullet record's `construction` that the start pressure reads. */
export interface StructureFields {
  structure?: string | undefined
}

/** Effective density is mass over the volume of the cylinder of diameter and length, by which the web app estimates a bullet's volume without a length (`apps/docs/docs/models/case-capacity.md`, "Bullet without a length"); `unknown` is the pooled class. */
export type DensityClass = 'cast' | 'monolithic' | 'jacketed' | 'unknown'

/** A bullet structure's construction, when it has one, and its density class. */
export interface BulletStructure {
  construction?: BulletConstruction
  density: DensityClass
}

/** Swaged is lead for the start pressure but of unknown density, as the cast class was measured on cast bullets only; a frangible bullet has no construction. */
export const bulletStructures: Readonly<Record<string, BulletStructure>> = {
  'cup-and-core': { construction: 'jacketed', density: 'jacketed' },
  bonded: { construction: 'jacketed', density: 'jacketed' },
  partitioned: { construction: 'jacketed', density: 'jacketed' },
  monolithic: { construction: 'monolithic', density: 'monolithic' },
  cast: { construction: 'lead', density: 'cast' },
  swaged: { construction: 'lead', density: 'unknown' },
  plated: { construction: 'plated', density: 'unknown' },
  frangible: { density: 'unknown' },
}

/** The entry of `bulletStructures` for a structure; undefined for none or one not listed. */
export const structureOf = (structure: string | undefined): BulletStructure | undefined =>
  structure !== undefined && Object.hasOwn(bulletStructures, structure)
    ? bulletStructures[structure]
    : undefined

/** A frangible bullet and a construction without a structure count as jacketed, `assumed`; undefined where the record gives no construction at all. */
export function constructionOf(
  fields: StructureFields | undefined,
): { construction: BulletConstruction; assumed: boolean } | undefined {
  if (!fields) return undefined
  const mapped = structureOf(fields.structure)?.construction
  return { construction: mapped ?? 'jacketed', assumed: mapped === undefined }
}

/** A start pressure rule with the construction it read, `assumed` where the record did not state one. */
export interface StartPressureRule extends StartPressureDefault {
  construction?: BulletConstruction
  assumed?: true
}

/** Barrel length in m; a handgun without a construction counts as jacketed (assumed, as in `defaultStartPressure`); without a barrel length, or for a rifle without a construction, the rifle assumption. */
export function startPressureOf(
  barrel: number | undefined,
  fields: StructureFields | undefined,
): StartPressureRule {
  if (barrel === undefined || !(barrel > 0)) return defaultStartPressure(handgunBarrelLengthLimit)
  const found =
    constructionOf(fields) ??
    (barrel < handgunBarrelLengthLimit
      ? { construction: 'jacketed' as const, assumed: true }
      : undefined)
  if (!found) return defaultStartPressure(barrel)
  return {
    ...defaultStartPressure(barrel, found.construction),
    construction: found.construction,
    ...(found.assumed && { assumed: true as const }),
  }
}
