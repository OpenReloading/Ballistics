import * as face from './face.ts'
import type { PartPoint } from './section.ts'
import type { Arrowhead, Label } from './types.ts'
import { add } from './vector.ts'

/** Is the segment clear of the box's bounding circle's square (the box grown by `pad`)? */
function clearOfReach(a: PartPoint, b: PartPoint, l: Label, reach: number) {
  return ([0, 1] as const).some(
    (k) => Math.max(a[k], b[k]) < l.c[k] - reach || Math.min(a[k], b[k]) > l.c[k] + reach,
  )
}

/** Clips the parameter range `t` against dd * t + ss <= lim; false when the segment is parallel and outside. */
function clipRange(t: [number, number], dd: number, ss: number, lim: number) {
  if (Math.abs(dd) < 1e-12) return !(ss > lim)
  const at = (lim - ss) / dd
  if (dd > 0) t[1] = Math.min(t[1], at)
  else t[0] = Math.max(t[0], at)
  return true
}

/** Does the segment cross the box (grown by `pad`)? */
export function segHitsBox({ a, b }: { a: PartPoint; b: PartPoint }, l: Label, pad = 0) {
  // most segments pass far from the box
  const reach = Math.hypot(l.w / 2 + pad, l.h / 2 + pad)
  if (clearOfReach(a, b, l, reach)) return false
  const [ux, uy] = l.dir
  const local = ([x, y]: PartPoint): PartPoint => {
    const [dx, dy] = [x - l.c[0], y - l.c[1]]
    return [dx * ux + dy * uy, -dx * uy + dy * ux]
  }
  const [p, q] = [local(a), local(b)]
  const [hw, hh] = [l.w / 2 + pad, l.h / 2 + pad]
  const t: [number, number] = [0, 1]
  const axes: [number, number, number][] = [
    [q[0] - p[0], p[0], hw],
    [q[1] - p[1], p[1], hh],
  ]
  for (const [d, s, lim] of axes) {
    if (!clipRange(t, d, s, lim) || !clipRange(t, -d, -s, lim)) return false
  }
  return t[0] <= t[1]
}

/** Do two text boxes (grown by `pad`) overlap? Separating axes of both. */
export function boxesOverlap(l: Label, m: Label, pad = 0) {
  const corners = (b: Label) => {
    const [ux, uy] = b.dir
    const [hw, hh] = [b.w / 2 + pad / 2, b.h / 2 + pad / 2]
    const quad: [number, number][] = [
      [hw, hh],
      [hw, -hh],
      [-hw, -hh],
      [-hw, hh],
    ]
    return quad.map(([s, t]): PartPoint => [b.c[0] + s * ux - t * uy, b.c[1] + s * uy + t * ux])
  }
  const [cl, cm] = [corners(l), corners(m)]
  const axes: PartPoint[] = [l.dir, [-l.dir[1], l.dir[0]], m.dir, [-m.dir[1], m.dir[0]]]
  for (const [ux, uy] of axes) {
    const proj = (pts: PartPoint[]) => pts.map(([x, y]) => x * ux + y * uy)
    const [a, b] = [proj(cl), proj(cm)]
    if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false
  }
  return true
}

/** Do segments pq and rs cross or touch? */
export function segsCross(p: PartPoint, q: PartPoint, r: PartPoint, s: PartPoint) {
  if (
    Math.max(p[0], q[0]) < Math.min(r[0], s[0]) ||
    Math.max(r[0], s[0]) < Math.min(p[0], q[0]) ||
    Math.max(p[1], q[1]) < Math.min(r[1], s[1]) ||
    Math.max(r[1], s[1]) < Math.min(p[1], q[1])
  )
    return false
  const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0])
  if (Math.abs(d) < 1e-12) return false
  const t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d
  const u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

/**
 * The four corners of a label's text box in the part frame, mm, in the order (+w/2, +h/2),
 * (+w/2, -h/2), (-w/2, -h/2), (-w/2, +h/2) from its centre, w along its direction, h across it.
 */
export const labelCorners = (l: Label): PartPoint[] => {
  const signs: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]
  return signs.map(([s, t]) => [
    l.c[0] + (s * l.w * l.dir[0]) / 2 - (t * l.h * l.dir[1]) / 2,
    l.c[1] + (s * l.w * l.dir[1]) / 2 + (t * l.h * l.dir[0]) / 2,
  ])
}

/** The corners of a filled arrowhead: its tip, then the two ends of its base. */
export function arrowheadCorners({ at, dir: [ux, uy] }: Arrowhead): PartPoint[] {
  const base = add(at, [ux, uy], -face.arrow.length)
  const h = face.arrow.width / 2
  return [at, [base[0] - uy * h, base[1] + ux * h], [base[0] + uy * h, base[1] - ux * h]]
}

/** Do two convex polygons overlap, or come nearer than `pad`? Separating axes of both. */
export function polygonsOverlap(p: PartPoint[], q: PartPoint[], pad = 0) {
  const apart = (nx: number, ny: number) => {
    let [p0, p1, q0, q1] = [Infinity, -Infinity, Infinity, -Infinity]
    for (const [x, y] of p) {
      const d = x * nx + y * ny
      p0 = Math.min(p0, d)
      p1 = Math.max(p1, d)
    }
    for (const [x, y] of q) {
      const d = x * nx + y * ny
      q0 = Math.min(q0, d)
      q1 = Math.max(q1, d)
    }
    return p1 + pad <= q0 || q1 + pad <= p0
  }
  if (apart(1, 0) || apart(0, 1)) return false
  for (const poly of [p, q])
    for (let i = 0; i < poly.length; i++) {
      const [a, b] = [poly[i], poly[(i + 1) % poly.length]]
      if (!a || !b) continue
      const l = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (l > 1e-12 && apart((a[1] - b[1]) / l, (b[0] - a[0]) / l)) return false
    }
  return true
}

/** Distance from a point to a text box, 0 inside it. */
export function boxDistance(l: Label, [x, y]: PartPoint) {
  const [dx, dy] = [x - l.c[0], y - l.c[1]]
  const [u, v] = [dx * l.dir[0] + dy * l.dir[1], -dx * l.dir[1] + dy * l.dir[0]]
  return Math.hypot(Math.max(Math.abs(u) - l.w / 2, 0), Math.max(Math.abs(v) - l.h / 2, 0))
}
