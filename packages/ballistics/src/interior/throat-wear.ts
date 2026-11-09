/** A worn throat adds the length the bullet's base no longer seals against, times the bore area, to the volume behind the bullet (`apps/docs/docs/models/interior-m3.md`, "Throat wear"). */

/** The volume behind the bullet, m³, with a worn throat of length `wear` (m) over a bore of area `boreArea` (m²). */
export const wornVolume = (volume: number, boreArea: number, wear: number): number =>
  volume + wear * boreArea
