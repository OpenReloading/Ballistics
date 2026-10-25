/** The target paper in a photo without a marked region: its light area by Otsu's threshold, as a convex hull. */
import type { RgbaImage } from './image.ts'
import { f32, f64, nth, u8 } from './nth.ts'
import { clamp, components, rectangle } from './raster-ops.ts'
import type { Point } from './target-geometry.ts'

/**
 * The target in a photo without a marked region (own rule): the convex hull of the largest light
 * area (luma above Otsu's threshold, on blocks of about 1/256 of the longer side), so the paper
 * with the face it holds; the whole photo when that area is under a tenth of it (a face that fills
 * the photo, a scan) or the two classes' mean lumas differ by less than 40 (one tone).
 */
export function paperOutline(image: RgbaImage): Point[] {
  const { width: W, height: H } = image
  const whole = rectangle({ x: 0, y: 0, width: W, height: H })
  const s = Math.max(1, Math.ceil(Math.max(W, H) / 256))
  const [w, h] = [Math.ceil(W / s), Math.ceil(H / s)]
  const lum = luminance(image, 0, 0, W, H, s, w, h)
  const hist = new Float64Array(256)
  for (const v of lum) {
    const bin = Math.round(clamp(v, 0, 255))
    hist[bin] = f64(hist, bin) + 1
  }
  const t = otsu(hist, w * h)
  let [dark, n] = [0, 0]
  for (let v = 0; v <= t; v++) [dark, n] = [dark + v * f64(hist, v), n + f64(hist, v)]
  let [lit, m] = [0, 0]
  for (let v = t + 1; v < 256; v++) [lit, m] = [lit + v * f64(hist, v), m + f64(hist, v)]
  // one tone (noise split in two): no paper to tell from a background
  if (!n || !m || lit / m - dark / n < 40) return whole
  const light = Uint8Array.from(lum, (v) => (v > t ? 1 : 0))
  const parts = components(light, w, h)
  const paper = parts.reduce((a, b) => (b.length > a.length ? b : a), [] as number[])
  if (paper.length < 0.1 * w * h) return whole
  // per row its first and last block, as image px at the outer block edges
  const ends = new Map<number, [number, number]>()
  for (const i of paper) {
    const [x, y] = [i % w, Math.floor(i / w)]
    const e = ends.get(y)
    ends.set(y, e ? [Math.min(e[0], x), Math.max(e[1], x)] : [x, x])
  }
  const pts: Point[] = []
  for (const [y, [a, b]] of ends)
    for (const yy of [y, y + 1]) pts.push({ x: a * s, y: yy * s }, { x: (b + 1) * s, y: yy * s })
  return convexHull(pts).map((p) => ({ x: clamp(p.x, 0, W), y: clamp(p.y, 0, H) }))
}

/** Convex hull, counter-clockwise (y down: clockwise on screen), by the monotone chain (A. M. Andrew, 1979). */
function convexHull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const half = (list: Point[]) => {
    const out: Point[] = []
    for (const q of list) {
      while (out.length >= 2 && cross(nth(out, out.length - 2), nth(out, out.length - 1), q) <= 0)
        out.pop()
      out.push(q)
    }
    out.pop()
    return out
  }
  return [...half(p), ...half([...p].reverse())]
}

/** Otsu's threshold of a histogram of `n` values: the last bin of the lower class. */
function otsu(hist: Float64Array, n: number): number {
  let total = 0
  for (let i = 0; i < hist.length; i++) total += i * f64(hist, i)
  let [sumB, wB, best, t] = [0, 0, -1, 0]
  for (let i = 0; i < hist.length; i++) {
    wB += f64(hist, i)
    if (!wB) continue
    const wF = n - wB
    if (!wF) break
    sumB += i * f64(hist, i)
    const between = wB * wF * (sumB / wB - (total - sumB) / wF) ** 2
    if (between > best) [best, t] = [between, i]
  }
  return t
}

/** Luma (ITU-R BT.601 weights, 0..255) of the crop, averaged over s x s blocks. */
function luminance(
  img: RgbaImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: number,
  w: number,
  h: number,
) {
  const sum = new Float32Array(w * h)
  const count = new Float32Array(w * h)
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / s) * w
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 4
      const j = row + Math.floor((x - x0) / s)
      sum[j] =
        f32(sum, j) +
        (0.299 * u8(img.data, i) + 0.587 * u8(img.data, i + 1) + 0.114 * u8(img.data, i + 2))
      count[j] = f32(count, j) + 1
    }
  }
  for (let j = 0; j < w * h; j++) sum[j] = f32(sum, j) / f32(count, j)
  return sum
}
