/** The colour axis of hole detection: Fisher's linear discriminant of a hole against its ring, in log RGB. */
import { clamp, median1 } from './raster-ops.ts'
import type { Point } from './target-geometry.ts'

/** The example disc and the ring around it (in D). */
export const DISC = 0.4
const RING: [number, number] = [1, 2.4]

/** The working image the axis reads: planar log(RGB + 8), `w` x `h` blocks. */
export type WorkImage = {
  w: number
  h: number
  logRgb: Float32Array
  inside: Uint8Array
  /** Least separation of a hole from its ring along the colour axis (log RGB units). */
  contrast: number
  /** 1 on the black area of the printed face, else 0; absent without a face. */
  blackMask?: Uint8Array
}

/** Unit axis `w` in log RGB, the hole colour `mu`, the ring median `ring` and their separation along `w`. */
type Axis = { w: number[]; mu: number[]; ring: number[]; sep: number }
/** The picked hole (work px), or the hole colour in log RGB without a pick. */
export type Seed = { at?: Point; mu?: number[] }

/**
 * Fisher's linear discriminant in log RGB: the mean of the disc of 0.4 D at the pick (or the
 * backing colour) minus the median of the ring from 1.0 to 2.4 D (or of the region), times the
 * inverse ring covariance, normalised. Holes project high.
 */
export function axisOf(
  ctx: WorkImage,
  holeDiameter: number,
  seed: Seed,
  disc = DISC * holeDiameter,
): Axis | undefined {
  const samples = collectSamples(ctx, holeDiameter, seed, disc)
  if (!samples) return undefined
  const { mu, ring } = samples
  if (!mu || ring[0].length < 30) return undefined
  const rm = ring.map((v) => median1(v))
  return fisherAxis(mu, rm, covariance3(ring), ctx.contrast)
}

/**
 * The hole colour (mean of the disc at the pick, else the seed's colour) and the ring samples per
 * channel; undefined when the disc holds no block.
 */
function collectSamples(
  ctx: WorkImage,
  holeDiameter: number,
  seed: Seed,
  disc: number,
): { mu: number[] | undefined; ring: number[][] } | undefined {
  const ring: number[][] = [[], [], []]
  if (!seed.at) {
    scatterRing(ctx, ring)
    return { mu: seed.mu, ring }
  }
  const mu = discAndRing(ctx, holeDiameter, seed.at, disc, ring)
  return mu ? { mu, ring } : undefined
}

/** The ring samples of a region without a pick: a strided scan of the pixels inside it. */
function scatterRing({ logRgb, w, h, inside }: WorkImage, ring: number[][]) {
  const n = w * h
  const step = Math.max(1, Math.floor(n / 20000))
  for (let i = 0; i < n; i += step) if (inside[i]) pushPixel(ring, logRgb, n, i)
}

/** Appends the three channels of pixel `i` of the planar image to `ring`. */
function pushPixel(ring: number[][], logRgb: Float32Array, n: number, i: number) {
  for (let c = 0; c < 3; c++) ring[c].push(logRgb[c * n + i])
}

/** The mean log RGB of the disc at the pick, undefined when the disc holds no block; fills `ring`. */
function discAndRing(
  ctx: WorkImage,
  holeDiameter: number,
  { x: cx, y: cy }: Point,
  disc: number,
  ring: number[][],
): number[] | undefined {
  const { logRgb, w, h, blackMask } = ctx
  const n = w * h
  // the surroundings of the same kind of surface as the hole's own (the face label)
  const kind = blackMask?.[Math.round(cy) * w + Math.round(cx)]
  const sum = [0, 0, 0]
  let count = 0
  const reach = RING[1] * holeDiameter
  const inRing = (r: number, i: number) =>
    r >= RING[0] * holeDiameter && r <= reach && (kind === undefined || blackMask?.[i] === kind)
  for (
    let y = Math.max(0, Math.floor(cy - reach));
    y <= Math.min(h - 1, Math.ceil(cy + reach));
    y++
  )
    for (
      let x = Math.max(0, Math.floor(cx - reach));
      x <= Math.min(w - 1, Math.ceil(cx + reach));
      x++
    ) {
      const r = Math.hypot(x - cx, y - cy)
      const i = y * w + x
      if (r <= disc) {
        count++
        for (let c = 0; c < 3; c++) sum[c] += logRgb[c * n + i]
      } else if (inRing(r, i)) pushPixel(ring, logRgb, n, i)
    }
  return count ? sum.map((v) => v / count) : undefined
}

/** Sums `cov` of the products of the deviations from the channel means (xx yy zz xy xz yz), and the count `m`. */
function covariance3(ring: number[][]): { cov: number[]; m: number } {
  const mean = ring.map((v) => v.reduce((a, b) => a + b, 0) / v.length)
  const cov = [0, 0, 0, 0, 0, 0] // xx yy zz xy xz yz
  const m = ring[0].length
  for (let i = 0; i < m; i++) {
    const d = [ring[0][i] - mean[0], ring[1][i] - mean[1], ring[2][i] - mean[2]]
    cov[0] += d[0] * d[0]
    cov[1] += d[1] * d[1]
    cov[2] += d[2] * d[2]
    cov[3] += d[0] * d[1]
    cov[4] += d[0] * d[2]
    cov[5] += d[1] * d[2]
  }
  return { cov, m }
}

/**
 * The unit axis of `mu` minus the ring median `rm` times the inverse of the regularised ring
 * covariance; undefined when the separation along it is under `minSep`.
 */
function fisherAxis(
  mu: number[],
  rm: number[],
  { cov, m }: { cov: number[]; m: number },
  minSep: number,
): Axis | undefined {
  const eps = (0.02 * (cov[0] + cov[1] + cov[2])) / (3 * m) + 1e-5
  const [a, b, c, d, e, f] = cov.map((v, i) => v / m + (i < 3 ? eps : 0))
  // inverse of [[a, d, e], [d, b, f], [e, f, c]] by cofactors
  const det = a * (b * c - f * f) - d * (d * c - f * e) + e * (d * f - b * e)
  const delta = mu.map((v, i) => v - rm[i])
  const inv = [
    [b * c - f * f, e * f - d * c, d * f - b * e],
    [e * f - d * c, a * c - e * e, d * e - a * f],
    [d * f - b * e, d * e - a * f, a * b - d * d],
  ]
  const raw = inv.map((row) => (row[0] * delta[0] + row[1] * delta[1] + row[2] * delta[2]) / det)
  const norm = Math.hypot(raw[0], raw[1], raw[2])
  if (!(norm > 0)) return undefined
  const axis = raw.map((v) => v / norm)
  // a hole that the ring does not set apart (blank paper, noise) gives no axis
  const sep = axis[0] * delta[0] + axis[1] * delta[1] + axis[2] * delta[2]
  if (sep < minSep) return undefined
  return { w: axis, mu, ring: rm, sep }
}

/** Luma (BT.601 weights) of a colour, here of log RGB values. */
export const lumaOf = (v: number[]) => 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]

/**
 * Per block, the BT.601 luma weights (0.299, 0.587, 0.114) applied to the log RGB of the working
 * image: the image whose strongest blobs seed the auto detection.
 */
export function logLuma(ctx: WorkImage): Float32Array {
  const n = ctx.w * ctx.h
  return Float32Array.from(
    { length: n },
    (_, i) => 0.299 * ctx.logRgb[i] + 0.587 * ctx.logRgb[n + i] + 0.114 * ctx.logRgb[2 * n + i],
  )
}

/**
 * The log RGB projected on the axis: the ring at 64 and a hole as separated from it as the picked
 * one at 192, cut to 0..255 (the scale comes from the axis, not from the region's statistics, so
 * blank paper stays flat).
 */
export function project(
  ctx: WorkImage,
  axis: Axis,
  region?: { x0: number; y0: number; w: number; h: number },
): Float32Array {
  const win = region ?? { x0: 0, y0: 0, w: ctx.w, h: ctx.h }
  const { w: wv, ring, sep } = axis
  const n = ctx.w * ctx.h
  const P = new Float32Array(win.w * win.h)
  const base = wv[0] * ring[0] + wv[1] * ring[1] + wv[2] * ring[2]
  for (let y = 0; y < win.h; y++)
    for (let x = 0; x < win.w; x++) {
      const i = (win.y0 + y) * ctx.w + win.x0 + x
      P[y * win.w + x] = clamp(
        64 +
          (128 *
            (wv[0] * ctx.logRgb[i] +
              wv[1] * ctx.logRgb[n + i] +
              wv[2] * ctx.logRgb[2 * n + i] -
              base)) /
            sep,
        0,
        255,
      )
    }
  return P
}

/** `P` mapped from its 0.5th to its 99.8th percentile in the region to 0..255, in place. */
export function rescale(P: Float32Array, inside: Uint8Array): Float32Array {
  const step = Math.max(1, Math.floor(P.length / 40000))
  const sample: number[] = []
  for (let i = 0; i < P.length; i += step) if (inside[i]) sample.push(P[i])
  if (sample.length < 16) for (let i = 0; i < P.length; i += step) sample.push(P[i])
  const sorted = Float32Array.from(sample).sort()
  const lo = sorted[Math.floor(0.005 * sorted.length)]
  const span = Math.max(
    1e-6,
    sorted[Math.min(sorted.length - 1, Math.floor(0.998 * sorted.length))] - lo,
  )
  for (let i = 0; i < P.length; i++) P[i] = clamp((255 * (P[i] - lo)) / span, 0, 255)
  return P
}
