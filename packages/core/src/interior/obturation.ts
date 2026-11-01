/**
 * Obturation of a plain-base cast bullet (`apps/docs/docs/models/interior-m3.md`, "Cast bullet
 * hardness"): a rule of thumb, not a model of the leak. The run is not changed.
 */

/** Pa per pound-force per square inch (NIST SP 811, 2008, appendix B.9). */
const pascalPerPsi = 6894.757293168

/**
 * Pressure per Brinell hardness number above which a plain-base cast bullet upsets to the bore, Pa:
 * 1422 psi per BHN (Fryxell, "Cast Bullet Alloys and Obturation", quoted by Wikipedia, "Obturation",
 * https://en.wikipedia.org/wiki/Obturation; the essay itself was not retrieved), about 9.80 MPa.
 */
export const obturationPressurePerBrinell = 1422 * pascalPerPsi

/** The construction fields the rule reads; a bullet record's `construction` is assignable to it. */
export interface CastConstruction {
  structure?: string | undefined
  gasCheck?: boolean | undefined
  core?: { hardness?: { value: number } | undefined } | undefined
}

/**
 * The Brinell hardness of a plain-base cast bullet: the core hardness when the structure is `cast`,
 * no gas check is stated (`gasCheck` absent or false) and a hardness is set; else undefined.
 */
export function plainBaseCastHardness(c: CastConstruction | undefined): number | undefined {
  if (c?.structure !== 'cast' || c.gasCheck === true) return
  return c.core?.hardness?.value
}

/**
 * Whether a plain-base cast bullet of Brinell hardness `brinell` is harder than the peak pressure
 * `peak` (Pa) upsets: `obturationPressurePerBrinell * brinell > peak`. Then the base may not seal
 * the bore and gas may leak past it.
 */
export const castHarderThanPeak = (brinell: number, peak: number) =>
  obturationPressurePerBrinell * brinell > peak
