import { bulletOutline } from './outline.ts'
import { type BulletValues, bulletDimensions } from './profile.ts'

/**
 * Density of lead at 20 °C, g/cm³ (Wikipedia, "Lead", infobox, https://en.wikipedia.org/wiki/Lead,
 * retrieved 2026-11-01).
 */
export const leadDensity = 11.348
/**
 * Density of copper at 20 °C, g/cm³ (Wikipedia, "Copper", infobox,
 * https://en.wikipedia.org/wiki/Copper, retrieved 2026-11-01).
 */
export const copperDensity = 8.935

/**
 * The material class of a bullet for its density bound: `lead` for a cast, swaged or plated bullet
 * or a lead core without a jacket, `copper` for a monolithic bullet or a copper core without a
 * jacket, `jacketed` for a jacket or a jacketed structure.
 */
export type MaterialClass = 'lead' | 'copper' | 'jacketed'

/** The construction fields the class reads; a bullet record's `construction` is assignable to it. */
export interface DensityConstruction {
  structure?: string | undefined
  core?: { material: string } | undefined
  jacket?: object | undefined
  unmapped?: true | undefined
}

const jacketedStructures = new Set(['cup-and-core', 'bonded', 'partitioned'])
const leadStructures = new Set(['cast', 'swaged', 'plated'])
const leadCores = new Set(['lead', 'lead-alloy'])
const copperCores = new Set(['copper', 'copper-alloy'])

/** The class of a core material: lead, copper, or another metal that settles no bound. */
const coreClass = (m: string | undefined): 'lead' | 'copper' | 'other' | undefined => {
  if (m === undefined) return
  if (leadCores.has(m)) return 'lead'
  return copperCores.has(m) ? 'copper' : 'other'
}

/** The class the jacket or the structure states, none where they state none. */
function structureClass(c: DensityConstruction): MaterialClass | undefined {
  const structure = c.structure ?? ''
  if (c.jacket || jacketedStructures.has(structure)) return 'jacketed'
  if (structure === 'monolithic') return 'copper'
  if (leadStructures.has(structure)) return 'lead'
}

/** The core each class goes with: a jacketed bullet has a lead core. */
const coreOf: Record<MaterialClass, 'lead' | 'copper'> = {
  jacketed: 'lead',
  copper: 'copper',
  lead: 'lead',
}

/**
 * The material class of a construction; undefined where it does not settle one, as for a core of
 * another metal or a core that contradicts the structure.
 */
export function materialClass(c: DensityConstruction | undefined): MaterialClass | undefined {
  if (!c || c.unmapped) return
  const core = coreClass(c.core?.material)
  if (core === 'other') return
  const structure = structureClass(c)
  if (!structure) return core
  return core === undefined || core === coreOf[structure] ? structure : undefined
}

/**
 * Density of a mixture of a copper jacket of mass share `jacketShare` (0 to 1) and a lead core,
 * g/cm³: the volumes of the two add, 1 / (f / rho_Cu + (1 - f) / rho_Pb).
 */
export const jacketedDensity = (jacketShare: number) =>
  1 / (jacketShare / copperDensity + (1 - jacketShare) / leadDensity)

/**
 * The highest density of each class, g/cm³. A jacketed bullet takes lead: a copper jacket is
 * lighter than lead, so any jacket share lowers the mixture below it ({@link jacketedDensity}); the
 * bound assumes no share (no source for one).
 */
export const materialDensityBound: Readonly<Record<MaterialClass, number>> = Object.freeze({
  lead: leadDensity,
  copper: copperDensity,
  jacketed: leadDensity,
})

/** The density a bullet's mass and outline imply, against the bound of its material class. */
export interface OutlineDensity {
  /** Mass over the outline volume, g/cm³. */
  density: number
  material: MaterialClass
  /** {@link materialDensityBound} of the class, g/cm³. */
  bound: number
  /** The density lies above the bound: the outline is too small for the mass, or the record is wrong. */
  exceeds: boolean
}

/**
 * The density a bullet record's mass and default outline imply (mass over the volume of
 * `bulletOutline`, a cavity taken off), against the highest density of its material class.
 * Undefined without a length, a diameter, an outline or a material class. A density above the bound
 * means the outline undercounts the volume (a round or flat nose drawn too slim) or a record value
 * is wrong.
 */
export function outlineDensity(
  r: BulletValues & { mass: { value: number }; construction?: DensityConstruction | undefined },
): OutlineDensity | undefined {
  const material = materialClass(r.construction)
  const shape = bulletDimensions(r)
  if (!material || !shape) return
  const o = bulletOutline(shape)
  if ('reason' in o || !(o.volume > 0)) return
  // g over mm³ to g/cm³
  const density = (r.mass.value / o.volume) * 1000
  const bound = materialDensityBound[material]
  return { density, material, bound, exceeds: density > bound }
}
