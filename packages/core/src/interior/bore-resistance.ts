import type { InteriorLoad } from './model.ts'

/**
 * Constants of the bore-resistance law of the load-table fit (`apps/docs/docs/models/interior-m3.md`,
 * "Bore resistance"): friction stress tau on the bullet side area, Pa; oversize coefficient c per percent;
 * engraving fraction f of the start pressure. 0 switches a term off.
 */
export interface ResistanceTerms {
  /** Friction stress tau on the bullet side area, Pa. */
  stress: number
  /** Oversize coefficient c, per percent of oversize. */
  oversize: number
  /** Engraving fraction f of the start pressure. */
  engraving: number
}

/** Cartridge inputs of the law: bullet diameter G1 and groove diameter Z, mm; bore area, mm2. */
export interface ResistanceCartridge {
  /** Bullet diameter G1, mm. */
  bulletDiameterMm: number
  /** Bore area, mm2. */
  boreAreaMm2: number
  /** Groove diameter Z, mm. */
  grooveDiameterMm?: number
}

/**
 * Bore area of a cartridge's chamber, in the square of the unit of the diameters: the C.I.P. area
 * Q (`area`) when the spec has it, else the circle of the mean of land diameter F and groove
 * diameter Z (`apps/docs/docs/models/interior-m3.md`, "Bore area"), else the circle of F. The load-table fit,
 * the load file and the workbench all read it, so one cartridge gives one area (and one friction
 * pressure, which divides by it).
 */
export function boreArea(b: {
  area?: number
  boreDiameter: number
  grooveDiameter?: number
}): number {
  return (
    b.area ?? (Math.PI / 4) * ((b.boreDiameter + (b.grooveDiameter ?? b.boreDiameter)) / 2) ** 2
  )
}

/** Oversize above which the C.I.P. limits are taken as not comparable, percent. */
export const maxOversizePercent = 5

/**
 * Bullet oversize over the groove diameter, 100 (G1 - Z) / Z in percent, 0 when negative;
 * undefined without Z or above `maxOversizePercent`. Both are C.I.P. tolerance limits, not measurements.
 */
export function oversizePercent(
  c: Pick<ResistanceCartridge, 'bulletDiameterMm' | 'grooveDiameterMm'>,
): number | undefined {
  if (!c.grooveDiameterMm) return undefined
  const o = (100 * (c.bulletDiameterMm - c.grooveDiameterMm)) / c.grooveDiameterMm
  return o > maxOversizePercent ? undefined : Math.max(0, o)
}

/**
 * Bore resistance of the law (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"): friction tau pi G1 L / A (1 + c o) and engraving
 * f p_st falling linearly to 0 over the bearing length L; undefined when both are 0. mm and mm2
 * in, Pa and m out.
 */
export function boreResistance(
  t: ResistanceTerms,
  c: ResistanceCartridge,
  bearing: number,
  startPressure: number,
): InteriorLoad['resistance'] {
  const friction =
    ((t.stress * Math.PI * c.bulletDiameterMm * bearing) / c.boreAreaMm2) *
    (1 + t.oversize * (oversizePercent(c) ?? 0))
  if (!(friction > 0) && !(t.engraving > 0)) return undefined
  return {
    ...(friction > 0 ? { friction } : {}),
    ...(t.engraving > 0
      ? {
          engraving: [
            { travel: 0, pressure: t.engraving * startPressure },
            { travel: bearing * 1e-3, pressure: 0 },
          ],
        }
      : {}),
  }
}

/** Run values of {@link recordResistance}: SI, the cartridge's G1 and Z and the bullet length in mm. */
export interface ResistanceRun {
  boreDiameter: number
  boreArea: number
  startPressure: number
  cartridge?: { g1?: number; z?: number }
  bulletLengthMm?: number
}

/** Result of {@link recordResistance}: the law for the run, or what the run lacks in `missing`. */
export interface RecordResistance {
  resistance?: InteriorLoad['resistance']
  missing: string[]
}

/**
 * The record's bore resistance for a run (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"): G1 of the
 * cartridge, else the bore diameter, and its groove diameter Z (none: no oversize term), as the
 * fit; the bullet record's length stands in for the bearing length. `missing` names what the run
 * lacks; both empty for a record without the law. Run values in SI.
 */
export function recordResistance(
  p: {
    interior?: { resistance?: { stress: { value: number } } & Omit<ResistanceTerms, 'stress'> }
  },
  run: ResistanceRun,
): RecordResistance {
  const law = p.interior?.resistance
  if (!law) return { missing: [] }
  const missing = [
    ...(run.cartridge ? [] : ['a cartridge record']),
    ...(run.bulletLengthMm ? [] : ['a bullet length']),
  ]
  if (!run.cartridge || !run.bulletLengthMm) return { missing }
  const resistance = boreResistance(
    { stress: law.stress.value * 1e5, oversize: law.oversize, engraving: law.engraving },
    {
      bulletDiameterMm: run.cartridge.g1 ?? run.boreDiameter * 1e3,
      boreAreaMm2: run.boreArea * 1e6,
      grooveDiameterMm: run.cartridge.z,
    },
    run.bulletLengthMm,
    run.startPressure,
  )
  return { resistance, missing }
}
