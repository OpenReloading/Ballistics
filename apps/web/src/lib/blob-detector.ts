/** Multi-scale blob detection on a float image: box-blur scale space, scale-normalised Hessian response, peaks. */

import { nth } from './nth.ts'
import { clamp } from './raster-ops.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const f32 = (a: Float32Array, i: number) => a[i] as number

/** Peaks closer than this (in D) are one. */
const NMS = 0.8

/** A blob peak: position (px), response and scale (px). */
export type Peak = { x: number; y: number; response: number; sigma: number }

/**
 * Box blur of radius r into `out` (which may be `src`), through the scratch buffer `tmp`; edge
 * pixels repeat.
 */
export function boxBlur(
  src: Float32Array,
  w: number,
  h: number,
  r: number,
  tmp: Float32Array,
  out: Float32Array,
): void {
  const k = 1 / (2 * r + 1)
  // rows through a padded copy, so the running sum needs no edge tests
  const line = new Float32Array(w + 2 * r + 1)
  for (let y = 0; y < h; y++) {
    const b = y * w
    line.fill(f32(src, b), 0, r)
    line.set(src.subarray(b, b + w), r)
    line.fill(f32(src, b + w - 1), r + w)
    let acc = 0
    for (let t = 0; t <= 2 * r; t++) acc += f32(line, t)
    for (let x = 0; x < w; x++) {
      tmp[b + x] = acc * k
      acc += f32(line, x + 2 * r + 1) - f32(line, x)
    }
  }
  // columns, row by row: a running sum per column keeps the reads in order
  const acc = new Float32Array(w)
  for (let t = -r; t <= r; t++) {
    const b = clamp(t, 0, h - 1) * w
    for (let x = 0; x < w; x++) acc[x] = f32(acc, x) + f32(tmp, b + x)
  }
  for (let y = 0; y < h; y++) {
    const [b, add, sub] = [y * w, Math.min(h - 1, y + r + 1) * w, Math.max(0, y - r) * w]
    for (let x = 0; x < w; x++) {
      out[b + x] = f32(acc, x) * k
      acc[x] = f32(acc, x) + (f32(tmp, add + x) - f32(tmp, sub + x))
    }
  }
}

/** Standard deviation of three box passes of radius r. */
const sigmaOf = (r: number) => Math.sqrt(((2 * r + 1) ** 2 - 1) / 4)

/** The box radii of the scales `factors` times D, without repeats, smallest first. */
export const radiiOf = (D: number, factors: number[]) => [
  ...new Set(
    factors.map((f) => Math.max(1, Math.round((Math.sqrt(4 * (f * D) ** 2 + 1) - 1) / 2))),
  ),
]

/**
 * Scale-normalised blob response at box radius r: sigma squared times the smaller magnitude
 * eigenvalue of the Hessian where both are negative (a bright blob), else 0, so a ring line
 * (one eigenvalue near 0) gives none.
 */
function response(P: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const B = new Float32Array(w * h)
  boxBlur(P, w, h, r, tmp, B)
  boxBlur(B, w, h, r, tmp, B)
  boxBlur(B, w, h, r, tmp, B)
  const R = new Float32Array(w * h)
  const k = sigmaOf(r) ** 2
  for (let y = 1; y < h - 1; y++)
    for (let x = 1, i = y * w + 1; x < w - 1; x++, i++) {
      const c = f32(B, i)
      const lxx = f32(B, i - 1) - 2 * c + f32(B, i + 1)
      const lyy = f32(B, i - w) - 2 * c + f32(B, i + w)
      // the larger eigenvalue; both are negative when it is
      const mid = (lxx + lyy) / 2
      if (mid >= 0) continue
      const lxy =
        (f32(B, i + w + 1) - f32(B, i + w - 1) - f32(B, i - w + 1) + f32(B, i - w - 1)) / 4
      const dd = (lxx - lyy) / 2
      const larger = mid + Math.sqrt(dd * dd + lxy * lxy)
      if (larger < 0) R[i] = -k * larger
    }
  return R
}

/** The responses of `P` at the box radii `radii`. */
export type Space = { w: number; h: number; radii: number[]; Rs: Float32Array[] }
export const space = (P: Float32Array, w: number, h: number, radii: number[]): Space => ({
  w,
  h,
  radii,
  Rs: radii.map((r) => response(P, w, h, r)),
})

/** The scale of the strongest response at pixel i among the first `count`, refined by a parabola in log sigma. */
export function sigmaAt(sp: Space, i: number, count = sp.radii.length): number {
  const { radii, Rs } = sp
  let a = 0
  for (let k = 1; k < count; k++) if (f32(nth(Rs, k), i) > f32(nth(Rs, a), i)) a = k
  const sigma = sigmaOf(nth(radii, a))
  if (a === 0 || a === count - 1) return sigma
  const [y0, y1, y2] = [f32(nth(Rs, a - 1), i), f32(nth(Rs, a), i), f32(nth(Rs, a + 1), i)]
  const den = y0 - 2 * y1 + y2
  if (!(den < 0)) return sigma
  const t = clamp((0.5 * (y0 - y2)) / den, -0.5, 0.5)
  return Math.exp(
    Math.log(sigma) +
      (t * (Math.log(sigmaOf(nth(radii, a + 1))) - Math.log(sigmaOf(nth(radii, a - 1))))) / 2,
  )
}

/**
 * Blob peaks of a scale space inside `inside`, strongest first: maxima over space and the first
 * `count` scales, within 0.8 D one peak.
 */
export function peaksOf(sp: Space, inside: Uint8Array, D: number, count = sp.radii.length): Peak[] {
  const { w, h, Rs } = sp
  const M = new Float32Array(w * h)
  for (let a = 0; a < count; a++) {
    const R = nth(Rs, a)
    for (let i = 0; i < M.length; i++) {
      const r = f32(R, i)
      if (r > f32(M, i)) M[i] = r
    }
  }
  const cand = localMaxima(M, inside, w, h)
  cand.sort((a, b) => b.v - a.v)
  const out: Peak[] = []
  for (const c of cand.slice(0, 600)) {
    const [x, y] = [c.i % w, Math.floor(c.i / w)]
    if (out.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 < (NMS * D) ** 2)) continue
    out.push({
      x: x + parabolaShift(f32(M, c.i - 1), c.v, f32(M, c.i + 1)),
      y: y + parabolaShift(f32(M, c.i - w), c.v, f32(M, c.i + w)),
      response: c.v,
      sigma: sigmaAt(sp, c.i, count),
    })
  }
  return out
}

/** The pixels inside the mask whose positive response no neighbour beats (ties go to the lower index). */
function localMaxima(
  M: Float32Array,
  inside: Uint8Array,
  w: number,
  h: number,
): Array<{ i: number; v: number }> {
  const cand: Array<{ i: number; v: number }> = []
  for (let y = 1; y < h - 1; y++)
    for (let x = 1, i = y * w + 1; x < w - 1; x++, i++) {
      const v = f32(M, i)
      if (!(v > 0) || !inside[i]) continue
      if (isTop(M, i, w, v)) cand.push({ i, v })
    }
  return cand
}

function isTop(M: Float32Array, i: number, w: number, v: number): boolean {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const j = i + dy * w + dx
      if ((dx || dy) && (f32(M, j) > v || (f32(M, j) === v && j < i))) return false
    }
  return true
}

/** Sub-pixel position from the parabola through the neighbours. */
function parabolaShift(m: number, c0: number, p: number) {
  const den = m - 2 * c0 + p
  return den < 0 ? clamp((0.5 * (m - p)) / den, -0.5, 0.5) : 0
}
