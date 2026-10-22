/**
 * Experimental shotshell interior model, `apps/docs/docs/models/interior-shotshell.md`: a shotshell load
 * mapped onto the M3 model `interior`. SI in and out, temperatures in K.
 */
import { type InteriorLoad, type InteriorOptions, type InteriorResult, interior } from './model.ts'

/**
 * Shotshell load, SI units: the `InteriorLoad` fields except chamber, barrel, bullet and start
 * pressure.
 */
export interface ShotshellLoad
  extends Omit<InteriorLoad, 'chamber' | 'barrel' | 'bullet' | 'startPressure'> {
  chamber: {
    /** Powder space: hull volume behind the seated wad, m3. */
    volume: number
    /** Bore diameter of the smooth bore, m. */
    boreDiameter: number
  }
  /** Wad travel from its seated position to the muzzle, m. */
  wadTravel: number
  /** Shot mass, kg. */
  shotMass: number
  /** Wad mass, kg. */
  wadMass: number
  /** Mean pressure at which the crimp opens and the column starts to move, Pa. */
  crimpPressure: number
}

/** Result of `shotshellInterior`: an `InteriorResult` marked experimental. */
export type ShotshellResult = InteriorResult & { experimental: true }

/**
 * The M3 load of a shotshell load (`apps/docs/docs/models/interior-shotshell.md`, "Mapping onto M3");
 * inputs as `shotshellInterior` checks them.
 */
export function shotshellInteriorLoad(load: ShotshellLoad): InteriorLoad {
  const { chamber, wadTravel, shotMass, wadMass, crimpPressure, ...rest } = load
  return {
    ...rest,
    chamber: { ...chamber, boreArea: (Math.PI / 4) * chamber.boreDiameter ** 2 },
    barrel: { length: wadTravel, twist: 0 },
    bullet: { mass: shotMass + wadMass },
    startPressure: crimpPressure,
  }
}

const pos = (v: number) => Number.isFinite(v) && v > 0
const nonNeg = (v: number) => Number.isFinite(v) && v >= 0

/** Runs `interior` on the mapped load; every result is labelled experimental. */
export function shotshellInterior(
  load: ShotshellLoad,
  options: Partial<InteriorOptions> = {},
): ShotshellResult {
  const checks: [string, boolean][] = [
    ['chamber.boreDiameter', pos(load.chamber.boreDiameter)],
    ['wadTravel', pos(load.wadTravel)],
    ['shotMass', pos(load.shotMass)],
    ['wadMass', nonNeg(load.wadMass)],
    ['crimpPressure', nonNeg(load.crimpPressure)],
  ]
  const field = checks.find(([, ok]) => !ok)?.[0]
  if (field) return { valid: false, reason: 'input', field, experimental: true }
  return { ...interior(shotshellInteriorLoad(load), options), experimental: true }
}
