/**
 * Which bullet diameters fit a cartridge, from its C.I.P. values only: the
 * bullet is larger than the middle of the land and groove diameters and at most the
 * projectile diameter G1 of the cartridge drawing. C.I.P. prints G1 as a maximum without a
 * tolerance; the middle of F and Z is the tightest lower bound from C.I.P. values that keeps a
 * bullet for every cartridge (Z lies above G1 for 303 British and 6,5 x 55 SE).
 */

/** The C.I.P. values the fit reads, mm, the records' stored unit. */
export type CartridgeDiameters = {
  /** Projectile diameter G1 on the cartridge side (a maximum). */
  g1: number
  /** Land (bore) diameter F of the barrel (a minimum). */
  land: number
  /** Groove diameter Z of the barrel (a minimum). */
  groove: number
}

/** Half the last printed digit of the two-decimal C.I.P. values, mm: G1 7.85 holds up to 7.855. */
export const cipRounding = 0.005

/** The fitting bullet diameters, mm: above `above`, up to and with `upTo`. */
export function bulletWindow(c: CartridgeDiameters): { above: number; upTo: number } {
  // 1e-9 mm keeps a bullet exactly on the upper bound despite binary rounding
  return { above: (c.land + c.groove) / 2, upTo: c.g1 + cipRounding + 1e-9 }
}

/** Whether a bullet of `diameter` (mm) lies in `bulletWindow` of `c`: above the land and groove middle, at most G1 plus the rounding. */
export function bulletFits(diameter: number, c: CartridgeDiameters): boolean {
  const w = bulletWindow(c)
  return diameter > w.above && diameter <= w.upTo
}
