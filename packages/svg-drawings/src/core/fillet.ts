import type { SectionPoint } from './types.ts'

/**
 * Samples n + 1 points of the arc of radius r tangent to the lines a-corner and corner-b, or
 * null when its tangent points do not lie on both segments. Up to 0.1 mm past a segment end the
 * arc is cut to that end: the double-radius shoulders of the records overrun it by rounding.
 */
export function fillet(
  a: SectionPoint,
  corner: SectionPoint,
  b: SectionPoint,
  r: number,
  n = 8,
): SectionPoint[] | null {
  const [cr, cz] = corner
  const unit = ([pr, pz]: SectionPoint): [number, number, number] => {
    const l = Math.hypot(pr - cr, pz - cz)
    return [(pr - cr) / l, (pz - cz) / l, l]
  }
  const [ur, uz, la] = unit(a)
  const [wr, wz, lb] = unit(b)
  const half = Math.acos(Math.min(1, Math.max(-1, ur * wr + uz * wz))) / 2
  const m = Math.hypot(ur + wr, uz + wz)
  // a straight line has no corner to round
  if (m < 1e-12) return [corner]
  const t = Math.min(r / Math.tan(half), la, lb)
  if (!(r / Math.tan(half) <= t + 0.1)) return null
  const d = t / Math.cos(half)
  const rt = t * Math.tan(half)
  const [or, oz] = [cr + ((ur + wr) / m) * d, cz + ((uz + wz) / m) * d]
  const a0 = Math.atan2(cz + uz * t - oz, cr + ur * t - or)
  let sweep = Math.atan2(cz + wz * t - oz, cr + wr * t - or) - a0
  if (sweep > Math.PI) sweep -= 2 * Math.PI
  if (sweep < -Math.PI) sweep += 2 * Math.PI
  const arc = Array.from({ length: n + 1 }, (_, k): SectionPoint => {
    const angle = a0 + (sweep * k) / n
    return [or + rt * Math.cos(angle), oz + rt * Math.sin(angle)]
  })
  // a cut arc ends exactly on the segment end, not a rounding error before it
  if (t === la) arc[0] = a
  if (t === lb) arc[n] = b
  return arc
}
