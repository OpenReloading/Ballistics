/**
 * A synthetic photograph of a bullet: the silhouette of the bullet drawing laid on a background
 * with a ruler, at a known scale, with lighting, blur and noise as choices. It is the sample the
 * photo tool offers to try, and the known truth the tests measure against
 * (`apps/docs/docs/models/bullet-photo.md`). Pure: no DOM, so tests and workers can use it.
 */
import { type BulletDimensions, bulletProfile } from '@open-reloading/drawing/bullet'
import { toSi } from '@open-reloading/schema'
import type { ScaleSpan } from './bullet-photo.ts'
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import { clamp } from './raster-ops.ts'
import type { Point } from './target-geometry.ts'

/** The ruler along the bottom of the photograph, graduated in mm. */
interface RulerSpec {
  /** Where its graduation starts, photo px. */
  x0: number
  /** Its top edge, photo px. */
  y: number
  heightPx: number
  lengthMm: number
  /** The strip runs to the edges of the photograph (it then touches them) or stops at its graduation. */
  toEdges: boolean
}

/** How the photograph is made. Greys are 0..255. */
export interface PhotoSpec {
  /** The bullet drawing, mm and degrees. */
  shape: BulletDimensions
  pxPerMm: number
  width: number
  height: number
  /** Where the base centre lies, photo px. */
  base: Point
  /** The direction of the axis from base to tip, rad (y down). */
  angle: number
  paper: number
  bullet: number
  /** The background's change in grey across the photograph's width (a lighting gradient). */
  gradient: number
  /** The bullet's change in grey from one edge to the other (side lighting). */
  shading: number
  /** Standard deviation of the noise, grey levels. */
  noise: number
  /** Standard deviation of the blur, px. */
  blur: number
  ruler?: RulerSpec | undefined
  seed: number
  /** A soft shadow beside the bullet: its silhouette moved by (dx, dy) px and blurred by `blur` px darkens the paper by `depth` (0 to 1). */
  shadow?: { dx: number; dy: number; blur: number; depth: number } | undefined
  /** The base face cut at this angle to the cross-section, degrees (a slanted sprue cut): it starts at the base on one side and this much further along the axis on the other. */
  obliqueBase?: number | undefined
  /** A reflection along the axis from `from` mm to the tip, `widthPx` wide, as light as the paper. */
  glare?: { from: number; widthPx: number } | undefined
  /** The nose beyond `from` mm is of this grey (a bright metal tip). */
  tip?: { from: number; grey: number } | undefined
  /** Black bars of this width at the left and right edges of the photograph. */
  bars?: number | undefined
  /** The bullet's red is raised and its blue lowered by this many grey levels at the same luma, so it differs from the paper by colour more than by brightness. */
  chroma?: number | undefined
}

/** The photograph with the truth it was made from. */
export interface BulletPhoto {
  image: RgbaImage
  /** The span of the ruler's graduation the scale is read from, with its exact ends. */
  span?: ScaleSpan
  /** The half profile [r, z] of the drawing, mm. */
  profile: [number, number][]
}

/** The made-up bullet of the sample: a boat tail with a tangent ogive and a cannelure, in mm. */
export const sampleShape: BulletDimensions = {
  diameter: 7.82,
  length: 31.5,
  noseLength: 18.5,
  meplatDiameter: 0.6,
  base: { type: 'boat-tail', length: 5.2, angle: 7 },
  ogive: { form: 'tangent', radiusRatio: 1 },
  cannelure: { start: 8.2, width: 0.9, depth: 0.16 },
}

/** The sample's photograph: the bullet lying at 3 degrees, a 45 mm ruler along the bottom edge. */
export const samplePhoto = (): BulletPhoto =>
  renderPhoto({
    shape: sampleShape,
    pxPerMm: 30,
    width: 1400,
    height: 700,
    base: { x: 190, y: 270 },
    angle: toSi('angle', 3),
    paper: 225,
    bullet: 120,
    gradient: 14,
    shading: 24,
    noise: 2.5,
    blur: 0.7,
    ruler: { x0: 20, y: 610, heightPx: 70, lengthMm: 45, toEdges: true },
    seed: 7,
  })

/** A deterministic uniform generator in [0, 1) (mulberry32). */
function random(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUB = 8

/** Where the polygon's edges cross the horizontal line at `sy`, left to right. */
function crossings(poly: readonly Point[], sy: number): number[] {
  const xs: number[] = []
  for (let i = 0; i < poly.length; i++) {
    const [a, b] = [nth(poly, i), nth(poly, (i + 1) % poly.length)]
    if (a.y > sy !== b.y > sy) xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x))
  }
  return xs.sort((p, q) => p - q)
}

/** Adds the coverage of the polygon to `cov`: exact across a row, `SUB` samples down a pixel. */
function fillPolygon(cov: Float32Array, w: number, h: number, poly: readonly Point[]): void {
  const ys = poly.map((p) => p.y)
  const lo = Math.max(0, Math.floor(Math.min(...ys)))
  const hi = Math.min(h - 1, Math.ceil(Math.max(...ys)))
  for (let y = lo; y <= hi; y++)
    for (let k = 0; k < SUB; k++) {
      const xs = crossings(poly, y + (k + 0.5) / SUB)
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const [xa, xb] = [clamp(nth(xs, i), 0, w), clamp(nth(xs, i + 1), 0, w)]
        for (let x = Math.floor(xa); x <= Math.min(w - 1, Math.floor(xb)); x++)
          cov[y * w + x] = nth(cov, y * w + x) + (Math.min(xb, x + 1) - Math.max(xa, x)) / SUB
      }
    }
}

const box = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
]

/** The separable Gaussian blur of `src`, standard deviation `sigma` px. */
function blurred(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0) return src
  const radius = Math.ceil(3 * sigma)
  const kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
    Math.exp(-((i - radius) ** 2) / (2 * sigma ** 2)),
  )
  const sum = kernel.reduce((a, v) => a + v, 0)
  const pass = (from: Float32Array, horizontal: boolean) => {
    const out = new Float32Array(w * h)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let i = -radius; i <= radius; i++) {
          const [u, v] = horizontal ? [clamp(x + i, 0, w - 1), y] : [x, clamp(y + i, 0, h - 1)]
          s += nth(kernel, i + radius) * nth(from, v * w + u)
        }
        out[y * w + x] = s / sum
      }
    return out
  }
  return pass(pass(src, true), false)
}

/** The silhouette of the drawing: the half profile mirrored about the axis, in photo px. */
function silhouette(profile: readonly [number, number][], spec: PhotoSpec): Point[] {
  const [ux, uy] = [Math.cos(spec.angle), Math.sin(spec.angle)]
  const at = (z: number, r: number): Point => ({
    x: spec.base.x + (ux * z - uy * r) * spec.pxPerMm,
    y: spec.base.y + (uy * z + ux * r) * spec.pxPerMm,
  })
  // an oblique base face: the plane through the base on the lower side, turned by `obliqueBase`
  const slope = Math.tan(((spec.obliqueBase ?? 0) * Math.PI) / 180)
  const half = Math.max(...profile.map(([r]) => r))
  const cut = (z: number, r: number) => Math.max(z, slope * (half + r))
  const upper = profile.map(([r, z]) => at(cut(z, r), r))
  const lower = profile.map(([r, z]) => at(cut(z, -r), -r)).reverse()
  return [...upper, ...lower]
}

/** The coverage of the ruler's strip and of its graduation ticks. */
function rulerLayers(spec: PhotoSpec): { strip: Float32Array; ticks: Float32Array } {
  const { width: w, height: h, ruler: r } = spec
  const strip = new Float32Array(w * h)
  const ticks = new Float32Array(w * h)
  if (!r) return { strip, ticks }
  const [x0, x1] = r.toEdges ? [0, w] : [r.x0 - 10, r.x0 + r.lengthMm * spec.pxPerMm + 10]
  fillPolygon(strip, w, h, box(x0, r.y, x1, r.y + r.heightPx))
  for (let mm = 0; mm <= r.lengthMm; mm++) {
    const x = r.x0 + mm * spec.pxPerMm
    const long = mm % 10 === 0 ? 24 : mm % 5 === 0 ? 16 : 9
    fillPolygon(ticks, w, h, box(x - 0.6, r.y, x + 0.6, r.y + long))
  }
  return { strip, ticks }
}

/** The grey of each pixel before blur and noise: the lit paper with its shadow, the ruler, then the bullet over them by its coverage. */
function composite(
  spec: PhotoSpec,
  bullet: Float32Array,
  shadow: Float32Array | undefined,
  rMax: number,
): Float32Array {
  const { width: w, height: h } = spec
  const { strip, ticks } = rulerLayers(spec)
  const [ux, uy] = [Math.cos(spec.angle), Math.sin(spec.angle)]
  const [vx, vy] = [-uy, ux]
  const grey = new Float32Array(w * h)
  for (let i = 0; i < grey.length; i++) {
    const [x, y] = [(i % w) + 0.5, Math.floor(i / w) + 0.5]
    const [dx, dy] = [x - spec.base.x, y - spec.base.y]
    const paper =
      (spec.paper + spec.gradient * (x / w - 0.5)) *
      (1 - (spec.shadow?.depth ?? 0) * clamp(shadow ? nth(shadow, i) : 0, 0, 1))
    const bg = paper + 0.85 * (60 - paper) * nth(strip, i)
    const withTicks = bg + (25 - bg) * clamp(nth(ticks, i), 0, 1)
    const side = (dx * vx + dy * vy) / rMax
    const z = (dx * ux + dy * uy) / spec.pxPerMm
    const lit = spec.tip && z > spec.tip.from ? spec.tip.grey : spec.bullet
    const glare =
      spec.glare && z > spec.glare.from && Math.abs(dx * vx + dy * vy) < spec.glare.widthPx / 2
    const fg = glare ? spec.paper - 4 : lit + spec.shading * clamp(side, -1, 1)
    grey[i] = withTicks + (fg - withTicks) * clamp(nth(bullet, i), 0, 1)
    if (spec.bars && (x < spec.bars || x > w - spec.bars)) grey[i] = 0
  }
  return grey
}

/** The scale span of the ruler's graduation: its first tick to its last full 5 mm, with the exact ends. */
function rulerSpan(spec: PhotoSpec): ScaleSpan | undefined {
  const r = spec.ruler
  if (!r) return
  const mm = Math.floor(r.lengthMm / 5) * 5
  const y = r.y + r.heightPx / 2
  return { a: { x: r.x0, y }, b: { x: r.x0 + mm * spec.pxPerMm, y }, mm }
}

/**
 * Renders the photograph of `spec`. Throws when the drawing refuses the shape.
 */
export function renderPhoto(spec: PhotoSpec): BulletPhoto {
  const { width: w, height: h } = spec
  const p = bulletProfile(spec.shape, () => true, 'entered')
  if ('reason' in p) throw new Error(p.reason)
  const profile = p.outline.points
  const bullet = new Float32Array(w * h)
  fillPolygon(bullet, w, h, silhouette(profile, spec))
  const shadow = spec.shadow && shadowOf(spec, profile)
  const rMax = Math.max(...profile.map(([q]) => q)) * spec.pxPerMm
  const soft = blurred(composite(spec, bullet, shadow, rMax), w, h, spec.blur)
  const cover = spec.chroma ? blurred(bullet, w, h, spec.blur) : undefined
  const rand = random(spec.seed)
  const data = new Uint8ClampedArray(4 * w * h)
  for (let i = 0; i < w * h; i++) {
    // Box-Muller
    const g = Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
    const v = nth(soft, i) + spec.noise * g
    const c = (spec.chroma ?? 0) * (cover ? nth(cover, i) : 0)
    // red up and blue down by c at the same luma
    data.set([v + c, v - 0.3151 * c, v - c, 255], 4 * i)
  }
  const span = rulerSpan(spec)
  return { image: { width: w, height: h, data }, ...(span && { span }), profile }
}

/** The coverage of the shadow: the silhouette moved by the shadow's offset and blurred. */
function shadowOf(spec: PhotoSpec, profile: readonly [number, number][]): Float32Array {
  const { width: w, height: h } = spec
  const moved = silhouette(profile, spec).map((q) => ({
    x: q.x + (spec.shadow?.dx ?? 0),
    y: q.y + (spec.shadow?.dy ?? 0),
  }))
  const cov = new Float32Array(w * h)
  fillPolygon(cov, w, h, moved)
  return blurred(cov, w, h, spec.shadow?.blur ?? 0)
}
