/**
 * Throat wear (`apps/docs/docs/models/interior-m3.md`, "Throat wear"): a worn throat adds the length
 * the bullet's base no longer seals against, times the bore area, to the volume behind the bullet.
 */

/** The volume behind the bullet, m³, with a worn throat of length `wear` (m) over a bore of area `boreArea` (m²). */
export const wornVolume = (volume: number, boreArea: number, wear: number) =>
  volume + wear * boreArea
