/**
 * Throat wear (`apps/docs/docs/models/interior-m3.md`, "Throat wear"): a worn throat adds the length
 * the bullet's base no longer seals against, times the bore area, to the volume behind the bullet.
 */

/** The volume behind the bullet, m³, with a worn throat of length `wear` (m) over a bore of area `boreArea` (m²). */
export const wornVolume = (volume: number, boreArea: number, wear: number) =>
  volume + wear * boreArea

/**
 * Measured muzzle velocity of one 5.56x45 mm barrel (361 mm) over its round count, 10-shot means,
 * and its chamber length by coordinate measuring machine new and after 16000 rounds. Vuong, Nguyen,
 * Khuong, Nguyen, "Interior ballistics modelling of a rifled barrel with cumulative wear effects",
 * Military Technical Courier (Vojnotehnički glasnik) 74(1), 2026, doi:10.5937/vojtehg75-64184,
 * licence CC BY 4.0; the velocities from its table 3 (the first count is shots 1 to 10),
 * the chamber lengths from its CMM section, the model results from its table 2.
 */
export const vuong2026 = Object.freeze({
  source: Object.freeze({
    authors: 'Vuong D. T., Nguyen V. H., Khuong T. L., Nguyen V. D.',
    title: 'Interior ballistics modelling of a rifled barrel with cumulative wear effects',
    journal: 'Military Technical Courier 74(1), 2026',
    doi: '10.5937/vojtehg75-64184',
    licence: 'CC BY 4.0',
  }),
  /** Round count and measured muzzle velocity, m/s. */
  velocity: Object.freeze([
    [0, 840.6],
    [8000, 821.3],
    [10000, 805.8],
    [12000, 802.5],
    [14000, 800.3],
    [16000, 785.8],
  ] as const),
  /** Chamber length new and after 16000 rounds, m: the axial wear length is their difference. */
  chamberLength: Object.freeze({ new: 49.2e-3, worn: 54.62e-3 }),
  /** The authors' model at 16000 rounds against the new barrel: peak pressure and muzzle velocity, relative. */
  modelChange: Object.freeze({
    peakPressure: 295.5 / 350.0 - 1,
    muzzleVelocity: 811.19 / 854.56 - 1,
  }),
})
