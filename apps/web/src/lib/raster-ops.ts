/** Raster operations on working images held as flat arrays, row by row: masks, morphology, distances, components. */
import type { Point } from './target-geometry.ts'

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const rectangle = (r: { x: number; y: number; width: number; height: number }): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
]

/** Even-odd rule. */
export function insidePolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}

/** Median of `v`, 0 for none. */
export function median1(v: readonly number[]): number {
  const s = [...v].sort((a, b) => a - b)
  return s.length
    ? s.length % 2
      ? s[s.length >> 1]
      : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
    : 0
}
type Pick = (a: number, b: number) => number

/** The running extreme from the start of each block of `size` pixels in `g`, to its end in `f`. */
function blockExtremes(
  line: Float32Array,
  len: number,
  size: number,
  pick: Pick,
  g: Float32Array,
  f: Float32Array,
) {
  for (let i = 0; i < len; i++) g[i] = i % size === 0 ? line[i] : pick(g[i - 1], line[i])
  for (let i = len - 1; i >= 0; i--)
    f[i] = i === len - 1 || (i + 1) % size === 0 ? line[i] : pick(f[i + 1], line[i])
}

/** The extreme of each window of 2k + 1 pixels from the block extremes. */
function windowExtremes(
  len: number,
  k: number,
  size: number,
  pick: Pick,
  g: Float32Array,
  f: Float32Array,
  res: Float32Array,
) {
  for (let i = 0; i < len; i++) {
    const lo = Math.max(0, i - k)
    const hi = Math.min(len - 1, i + k)
    // One block: the window starts at its first pixel or ends at its last one.
    if (Math.floor(lo / size) !== Math.floor(hi / size)) res[i] = pick(f[lo], g[hi])
    else res[i] = lo % size === 0 ? g[hi] : f[lo]
  }
}

/**
 * Maximum (`max`) or minimum over a (2k + 1) square, rows then columns, three comparisons per
 * pixel whatever k (van Herk; Gil and Werman). The window is cut at the image edge.
 */
function minMax(src: Float32Array, w: number, h: number, k: number, max: boolean): Float32Array {
  const pick = max ? Math.max : Math.min
  const rows = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  const n = Math.max(w, h)
  const [g, f, line, res] = [
    new Float32Array(n),
    new Float32Array(n),
    new Float32Array(n),
    new Float32Array(n),
  ]
  const pass = (
    from: Float32Array,
    to: Float32Array,
    len: number,
    lines: number,
    step: number,
    stride: number,
  ) => {
    const size = 2 * k + 1
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < len; i++) line[i] = from[l * stride + i * step]
      blockExtremes(line, len, size, pick, g, f)
      windowExtremes(len, k, size, pick, g, f, res)
      for (let i = 0; i < len; i++) to[l * stride + i * step] = res[i]
    }
  }
  pass(src, rows, w, h, 1, w)
  pass(rows, out, h, w, w, 1)
  return out
}

/**
 * Opening (`closing` false) or closing by a (2k + 1) square. The image is first extended by k pixels
 * that repeat its edge, so a square may reach past the edge and features at the edge keep their
 * shape.
 */
function morph(src: Float32Array, w: number, h: number, k: number, closing: boolean) {
  const [pw, ph] = [w + 2 * k, h + 2 * k]
  const padded = new Float32Array(pw * ph)
  for (let y = 0; y < ph; y++)
    for (let x = 0; x < pw; x++)
      padded[y * pw + x] = src[clamp(y - k, 0, h - 1) * w + clamp(x - k, 0, w - 1)]
  const out = minMax(minMax(padded, pw, ph, k, closing), pw, ph, k, !closing)
  const res = new Float32Array(w * h)
  for (let y = 0; y < h; y++) res.set(out.subarray((y + k) * pw + k, (y + k) * pw + k + w), y * w)
  return res
}

export const open = (src: Float32Array, w: number, h: number, k: number) =>
  morph(src, w, h, k, false)

/** Where the parabola rooted at `q` overtakes the one rooted at `p`. */
const crossing = (f: Float64Array, q: number, p: number) =>
  (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p)

/** The parabolas of the lower envelope of the samples `f`: roots in `v`, the bounds between them in `z`. */
function lowerEnvelope(f: Float64Array, len: number, v: Int32Array, z: Float64Array) {
  let j = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < len; q++) {
    let s = crossing(f, q, v[j])
    while (s <= z[j]) {
      j--
      s = crossing(f, q, v[j])
    }
    j++
    v[j] = q
    z[j] = s
    z[j + 1] = Infinity
  }
}

function readEnvelope(
  f: Float64Array,
  len: number,
  v: Int32Array,
  z: Float64Array,
  out: Float64Array,
) {
  let j = 0
  for (let q = 0; q < len; q++) {
    while (z[j + 1] < q) j++
    out[q] = (q - v[j]) ** 2 + f[v[j]]
  }
}

/**
 * Squared Euclidean distance of every pixel to the nearest pixel whose mask value is `target`
 * (Felzenszwalb and Huttenlocher, lower envelope of parabolas, rows then columns).
 */
export function distanceSquared(
  mask: Uint8Array,
  w: number,
  h: number,
  target: number,
): Float64Array {
  const INF = 1e20
  const d = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) d[i] = mask[i] === target ? 0 : INF
  const n = Math.max(w, h)
  const [f, out, v, z] = [
    new Float64Array(n),
    new Float64Array(n),
    new Int32Array(n),
    new Float64Array(n + 1),
  ]
  const pass = (len: number, lines: number, step: number, stride: number) => {
    for (let l = 0; l < lines; l++) {
      for (let i = 0; i < len; i++) f[i] = d[l * stride + i * step]
      lowerEnvelope(f, len, v, z)
      readEnvelope(f, len, v, z, out)
      for (let i = 0; i < len; i++) d[l * stride + i * step] = out[i]
    }
  }
  pass(w, h, 1, w)
  pass(h, w, w, 1)
  return d
}

/** Pixel indices of each 8-connected component of the mask, by flood fill. */
export function components(mask: Uint8Array, w: number, h: number): number[][] {
  const seen = new Uint8Array(w * h)
  const stack = new Int32Array(w * h)
  const out: number[][] = []
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || seen[start]) continue
    out.push(flood(start, mask, w, h, seen, stack))
  }
  return out
}

function flood(
  start: number,
  mask: Uint8Array,
  w: number,
  h: number,
  seen: Uint8Array,
  stack: Int32Array,
): number[] {
  const pixels: number[] = []
  let top = 0
  stack[top++] = start
  seen[start] = 1
  while (top) {
    const i = stack[--top]
    pixels.push(i)
    const [x, y] = [i % w, Math.floor(i / w)]
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const [u, v] = [x + dx, y + dy]
        const j = v * w + u
        if (u >= 0 && u < w && v >= 0 && v < h && mask[j] && !seen[j]) {
          seen[j] = 1
          stack[top++] = j
        }
      }
  }
  return pixels
}
