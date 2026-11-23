/** Seeded synthetic target photos for training a hole detector: faces at the true ring geometry of the face records, holes with tears, rims, halos and folded flaps, print and dirt that look like holes, a sheet edge, light and noise; `make-synthetic.mts` adds blur and JPEG and writes them. Pixel centers are integer coordinates. */

import { normalsFrom, seededUniforms } from '@rangefoundry/statistics'
import { clamp } from '../../../src/raster-ops.ts'
import type { PrintedFace } from '../../../src/target-face.ts'
import { defined } from '../../defined.ts'
import { camera, faces, invert, project } from '../../face-render.ts'

type Rgb = readonly [number, number, number]
type Point = { x: number; y: number }

/** Photo side in px, the visible hole diameter range in px and the hole count range. */
export type SynthOptions = { size: number; diameter: [number, number]; holes: [number, number] }

/** Relative frequency of each face kind; reactive faces show a bright halo around a dark hole. */
const KINDS = { printed: 5, colored: 2, dark: 3, reactive: 3, grid: 2, region: 2, blank: 2 }
type Kind = keyof typeof KINDS

export type SynthPhoto = {
  kind: Kind
  size: number
  /** RGB bytes before blur and compression. */
  rgb: Uint8ClampedArray
  /** Gaussian blur sigma in px, 0 for none. */
  blur: number
  jpeg: number
  visibleDiameterPx: number
  /** Hole centers in photo px. */
  holes: Point[]
}

const PAPERS: Rgb[] = [
  [232, 230, 222],
  [246, 245, 240],
  [216, 206, 182],
  [204, 204, 204],
  [236, 226, 196],
]
const BLACKS: Rgb[] = [
  [28, 28, 30],
  [18, 18, 20],
  [46, 46, 50],
  [60, 58, 62],
]
const COLORS: Rgb[] = [
  [200, 40, 40],
  [228, 112, 34],
  [30, 60, 150],
  [30, 110, 50],
  [240, 210, 40],
]
/** What shows through a hole: board, dark cloth, light card, wood, grey, sky, foliage, sand. */
const BACKINGS: Rgb[] = [
  [58, 56, 54],
  [15, 15, 16],
  [226, 224, 216],
  [150, 115, 75],
  [120, 120, 120],
  [90, 140, 200],
  [60, 90, 50],
  [200, 170, 120],
]
const HALOS: Rgb[] = [
  [235, 225, 60],
  [140, 230, 60],
  [240, 240, 235],
  [250, 150, 40],
  [250, 90, 160],
]
const TABLES: Rgb[] = [
  [120, 85, 55],
  [40, 40, 42],
  [128, 128, 124],
  [70, 100, 55],
  [190, 180, 165],
]
/** Bullet diameters in mm from 4.5 mm to .45. */
const CALIBERS = [4.5, 5.6, 6.5, 7.62, 9, 11.43]

class Rand {
  readonly #next: () => number
  readonly normal: () => number
  constructor(seed: number) {
    this.#next = seededUniforms(seed)
    this.normal = normalsFrom(this.#next)
  }
  u(lo = 0, hi = 1): number {
    return lo + (hi - lo) * this.#next()
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.#next() * (hi - lo + 1))
  }
  chance(p: number): boolean {
    return this.#next() < p
  }
  pick<T>(xs: readonly T[]): T {
    return defined(xs[Math.floor(this.#next() * xs.length)])
  }
  weighted<K extends string>(weights: Record<K, number>): K {
    const entries = Object.entries(weights) as [K, number][]
    let x = this.u(
      0,
      entries.reduce((sum, [, w]) => sum + w, 0),
    )
    for (const [key, w] of entries) {
      x -= w
      if (x < 0) return key
    }
    return defined(entries.at(-1))[0]
  }
  color(palette: readonly Rgb[], jitter: number): Rgb {
    return shade(this.pick(palette), 1, () => jitter * this.normal())
  }
  angle(): number {
    return this.u(0, 2 * Math.PI)
  }
}

const shade = (c: Rgb, f: number, add = () => 0): Rgb => [
  clamp(c[0] * f + add(), 0, 255),
  clamp(c[1] * f + add(), 0, 255),
  clamp(c[2] * f + add(), 0, 255),
]

/** Coverage of a shape from its signed distance in px (negative inside), about 1 px soft. */
const cover = (d: number): number => clamp(0.5 - d, 0, 1)

/** Distance of `x` to the nearest multiple of `step`. */
const fold = (x: number, step: number): number => Math.abs(x - step * Math.round(x / step))

/** Point `p` in the frame turned by `a` about `c`. */
const turn = (p: Point, c: Point, a: number): Point => {
  const [dx, dy] = [p.x - c.x, p.y - c.y]
  return { x: Math.cos(a) * dx + Math.sin(a) * dy, y: -Math.sin(a) * dx + Math.cos(a) * dy }
}

class Raster {
  readonly size: number
  readonly px: Float32Array
  constructor(size: number) {
    this.size = size
    this.px = new Float32Array(size * size * 3)
  }
  paint(i: number, coverage: number, c: Rgb): void {
    if (coverage <= 0) return
    for (let k = 0; k < 3; k++) {
      const old = defined(this.px[3 * i + k])
      this.px[3 * i + k] = old + Math.min(coverage, 1) * (defined(c[k]) - old)
    }
  }
  /** Calls `f` for every pixel of the square of half side `r` about `c`, clipped to the photo. */
  each(
    f: (x: number, y: number, i: number) => void,
    c: Point = { x: 0, y: 0 },
    r = Infinity,
  ): void {
    const [x0, y0] = [Math.max(0, Math.floor(c.x - r)), Math.max(0, Math.floor(c.y - r))]
    const [x1, y1] = [Math.min(this.size - 1, c.x + r), Math.min(this.size - 1, c.y + r)]
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) f(x, y, y * this.size + x)
  }
}

/** The face plane seen by the camera: `s` photo px per face mm at the face center. */
type View = { s: number; toFace: (p: Point) => Point; toPhoto: (p: Point) => Point }

/** What every drawing step of one photo shares: the random stream, the raster, the view, the hole diameter in px and the paper. */
type Scene = { rnd: Rand; img: Raster; v: View; D: number; paper: Rgb }

function view(rnd: Rand, size: number, s: number): View {
  const h = camera({
    width: size,
    height: size,
    pxPerMm: s,
    tilt: rnd.u(-20, 20),
    yaw: rnd.u(-20, 20),
    roll: rnd.u(0, 360),
    at: { x: rnd.u(-0.6, 1.6) * size, y: rnd.u(-0.6, 1.6) * size },
  })
  const inv = invert(h)
  return { s, toFace: (p) => project(inv, p), toPhoto: (p) => project(h, p) }
}

const SEGMENTS: Record<string, [number, number, number, number]> = {
  a: [-0.25, 0.5, 0.25, 0.5],
  b: [0.25, 0.5, 0.25, 0],
  c: [0.25, 0, 0.25, -0.5],
  d: [-0.25, -0.5, 0.25, -0.5],
  e: [-0.25, 0, -0.25, -0.5],
  f: [-0.25, 0.5, -0.25, 0],
  g: [-0.25, 0, 0.25, 0],
}
const DIGITS = [
  'abcdef',
  'bc',
  'abdeg',
  'abcdg',
  'bcfg',
  'acdfg',
  'acdefg',
  'abc',
  'abcdefg',
  'abcdfg',
]

/** Distance from (x, y), y up, to the strokes of the digits `text` in seven segments of height 1 centered on the origin. */
function textDistance(text: string, x: number, y: number): number {
  let best = Infinity
  for (let n = 0; n < text.length; n++) {
    const dx = x - (n - (text.length - 1) / 2) * 0.75
    for (const seg of defined(DIGITS[Number(text.charAt(n))])) {
      const [x0, y0, x1, y1] = defined(SEGMENTS[seg])
      const [wx, wy] = [x1 - x0, y1 - y0]
      const t = clamp(((dx - x0) * wx + (y - y0) * wy) / (wx * wx + wy * wy), 0, 1)
      best = Math.min(best, Math.hypot(dx - x0 - t * wx, y - y0 - t * wy))
    }
  }
  return best
}

/** Digits of `height` px centered at photo point `c`. */
type Label = { text: string; c: Point; height: number; color: Rgb }

/** Paints `label`; `local` maps a photo point to px of the label's upright frame (y up). */
function drawText(img: Raster, label: Label, local: (p: Point) => Point): void {
  const { text, height } = label
  img.each(
    (x, y, i) => {
      const q = local({ x, y })
      img.paint(
        i,
        cover(height * (textDistance(text, q.x / height, q.y / height) - 0.07)),
        label.color,
      )
    },
    label.c,
    height * (0.6 + 0.4 * text.length),
  )
}

/** A face record's ring radii in mm, largest first, and the colors it is printed in. */
type Look = {
  face: PrintedFace
  radii: number[]
  outer: number
  blackR: number
  halfLine: number
  ink: Rgb
  pale: Rgb
  accent: Rgb
}

function look({ rnd, v }: Scene, kind: Kind): Look {
  const face = rnd.pick(faces)
  const inner = face.innerTen ? [face.innerTen.diameter.value / 2] : []
  const radii = [...face.rings.map((r) => r.diameter.value / 2), ...inner].toSorted((a, b) => b - a)
  const outer = defined(radii[0])
  return {
    face,
    radii,
    outer,
    blackR: face.blackDiameter.value / 2,
    halfLine: Math.max(0.4 / v.s, outer * rnd.u(0.002, 0.008)),
    ink: rnd.color(BLACKS, 5),
    pale: shade(rnd.color(PAPERS, 8), rnd.u(0.6, 1)),
    accent: rnd.color(kind === 'reactive' ? [...COLORS, ...HALOS] : COLORS, 14),
  }
}

/** Paints one pixel of the face at face point `p` (mm) and radius `r`; `ring` is the coverage of the nearest ring line. */
type Shader = (i: number, p: Point, r: number, ring: () => number) => void

/** The shader of each face kind: a face record in four color schemes, a grid, a color region or blank paper. */
function shaders({ rnd, img, v }: Scene, l: Look): Record<Kind, () => Shader> {
  const disc = (r: number, radius: number) => cover((r - radius) * v.s)
  return {
    printed: () => (i, _p, r, ring) => {
      img.paint(i, disc(r, l.blackR), l.ink)
      img.paint(i, ring(), r < l.blackR ? l.pale : l.ink)
    },
    colored: () => {
      const [diamond, half] = [rnd.chance(0.5), l.blackR * rnd.u(1.2, 2)]
      return (i, p, r, ring) => {
        const [ax, ay] = [Math.abs(p.x), Math.abs(p.y)]
        img.paint(i, cover(((diamond ? ax + ay : Math.max(ax, ay)) - half) * v.s), l.ink)
        img.paint(i, disc(r, l.blackR), l.accent)
        img.paint(i, ring(), l.ink)
      }
    },
    dark: () => (i, _p, r, ring) => {
      img.paint(i, disc(r, l.outer), l.ink)
      img.paint(i, ring(), l.pale)
    },
    reactive: () => {
      const [glow, share, center] = [rnd.color(HALOS, 10), rnd.u(0.5, 1), rnd.chance(0.4)]
      img.each((_x, _y, i) => img.paint(i, 1, l.ink))
      return (i, _p, r, ring) => {
        img.paint(i, ring() * share, glow)
        if (center) img.paint(i, disc(r, l.blackR), l.accent)
      }
    },
    grid: () => {
      const [step, color] = [l.outer * rnd.u(0.04, 0.2), rnd.chance(0.6) ? l.ink : l.accent]
      return (i, p) =>
        img.paint(i, cover((Math.min(fold(p.x, step), fold(p.y, step)) - l.halfLine) * v.s), color)
    },
    region: () => {
      const [a, radius, half] = [rnd.angle(), l.outer * rnd.u(0.2, 1), rnd.chance(0.5)]
      const color = rnd.color([...BLACKS, ...COLORS, ...TABLES], 12)
      return (i, p, r) =>
        img.paint(
          i,
          disc(half ? Math.cos(a) * p.x + Math.sin(a) * p.y : r, half ? 0 : radius),
          color,
        )
    },
    blank: () => () => undefined,
  }
}

/** Paints the face over the whole photo and, on a face record, its ring numerals. */
function drawFace(scene: Scene, kind: Kind): void {
  const { img, v } = scene
  const l = look(scene, kind)
  const shader = shaders(scene, l)[kind]()
  img.each((x, y, i) => {
    const p = v.toFace({ x, y })
    const r = Math.hypot(p.x, p.y)
    const ring = () => {
      let near = Infinity
      for (const rr of l.radii) near = Math.min(near, Math.abs(r - rr))
      return cover((near - l.halfLine) * v.s)
    }
    shader(i, p, r, ring)
  })
  if (['printed', 'colored', 'dark'].includes(kind) && scene.rnd.chance(0.7))
    drawNumerals(scene, l, kind === 'printed' ? l.blackR : l.outer)
}

/** The ring values in their zones on both axes, upright on the face, light where `dark` (mm) covers them. */
function drawNumerals({ img, v }: Scene, l: Look, dark: number): void {
  const rings = l.face.rings.toSorted((a, b) => b.diameter.value - a.diameter.value)
  for (const [n, ring] of rings.slice(0, -2).entries()) {
    const r = ring.diameter.value / 2
    const gap = r - defined(rings[n + 1]).diameter.value / 2
    if (!Number.isInteger(ring.value) || ring.value < 0) continue
    const mid = r - gap / 2
    for (const at of [
      { x: mid, y: 0 },
      { x: -mid, y: 0 },
      { x: 0, y: mid },
      { x: 0, y: -mid },
    ]) {
      const local = (q: Point) => {
        const f = v.toFace(q)
        return { x: (f.x - at.x) * v.s, y: (f.y - at.y) * v.s }
      }
      const color = mid < dark ? l.pale : l.ink
      drawText(
        img,
        { text: String(ring.value), c: v.toPhoto(at), height: 0.4 * gap * v.s, color },
        local,
      )
    }
  }
}

/** A random point of the photo. */
const spot = ({ rnd, img }: Scene): Point => ({ x: rnd.u(0, img.size), y: rnd.u(0, img.size) })

/** Loose numerals at any angle, stains and pen strokes. */
function drawMarks(scene: Scene, darkFace: boolean): void {
  const { rnd, img, D, paper } = scene
  for (let n = rnd.pick([0, 0, 1, 2, 4, 6]); n > 0; n--) {
    const [c, height, a] = [spot(scene), rnd.u(0.6, 1.7) * D, rnd.angle()]
    const color = darkFace || rnd.chance(0.2) ? paper : rnd.color(BLACKS, 5)
    const local = (q: Point) => {
      const t = turn(q, c, a)
      return { x: t.x, y: -t.y }
    }
    drawText(img, { text: String(rnd.int(0, 10)), c, height, color }, local)
  }
  for (let n = rnd.pick([0, 0, 1, 2]); n > 0; n--) {
    const [c, sigma, alpha] = [spot(scene), rnd.u(0.3, 1.6) * D, rnd.u(0.1, 0.45)]
    const color = rnd.color(
      [
        [110, 85, 50],
        [60, 60, 60],
        [150, 140, 110],
      ],
      15,
    )
    const blob = (x: number, y: number) =>
      Math.exp(-((x - c.x) ** 2 + (y - c.y) ** 2) / (2 * sigma ** 2))
    img.each((x, y, i) => img.paint(i, alpha * blob(x, y), color), c, 3 * sigma)
  }
  for (let n = rnd.pick([0, 0, 0, 1, 2]); n > 0; n--) {
    const [p, q, halfWidth] = [spot(scene), spot(scene), rnd.u(0.04, 0.12) * D]
    const color = rnd.color(
      [
        [25, 35, 120],
        [20, 20, 20],
        [170, 30, 30],
      ],
      10,
    )
    const [wx, wy] = [q.x - p.x, q.y - p.y]
    img.each((x, y, i) => {
      const t = clamp(((x - p.x) * wx + (y - p.y) * wy) / (wx * wx + wy * wy + 1e-6), 0, 1)
      img.paint(i, cover(Math.hypot(x - p.x - t * wx, y - p.y - t * wy) - halfWidth), color)
    })
  }
}

/** Pasters, which hide older holes on a real target, and printed dots smaller or larger than a hole. */
function drawPatches(scene: Scene): void {
  const { rnd, img, D, paper } = scene
  for (let n = rnd.pick([0, 0, 0, 1, 2]); n > 0; n--) {
    const [c, a, half] = [spot(scene), rnd.u(0, Math.PI), rnd.u(0.6, 1) * D]
    const color = rnd.color([paper, [28, 28, 30], [205, 180, 140], [240, 240, 236]], 8)
    const box = (q: Point) => Math.max(Math.abs(q.x), Math.abs(q.y))
    img.each(
      (x, y, i) => img.paint(i, cover(box(turn({ x, y }, c, a)) - half), color),
      c,
      1.5 * half,
    )
  }
  for (let n = rnd.pick([0, 0, 0, 1, 3]); n > 0; n--) {
    const [c, radius] = [spot(scene), D * (rnd.chance(0.6) ? rnd.u(0.08, 0.22) : rnd.u(1.2, 2.2))]
    const color = rnd.color([...BLACKS, ...COLORS], 8)
    img.each(
      (x, y, i) => img.paint(i, cover(Math.hypot(x - c.x, y - c.y) - radius), color),
      c,
      radius + 1,
    )
  }
}

type HoleStyle = {
  backing: Rgb
  halo: Rgb | undefined
  haloR: number
  rim: Rgb | undefined
  rimWidth: number
  rimAlpha: number
  depth: number
  flap: number
}

function holeStyle({ rnd, paper }: Scene, kind: Kind): HoleStyle {
  const reactive = kind === 'reactive' || (['dark', 'colored'].includes(kind) && rnd.chance(0.15))
  const backing = rnd.color(reactive && rnd.chance(0.7) ? BACKINGS.slice(0, 2) : BACKINGS, 10)
  const halo = reactive ? rnd.color(HALOS, 10) : undefined
  const rims = {
    none: undefined,
    wipe: rnd.color(
      [
        [90, 88, 86],
        [60, 60, 62],
      ],
      8,
    ),
    fiber: shade(paper, rnd.u(1, 1.1)),
    burnt: rnd.color([[46, 34, 26]], 6),
  }
  const rim = rims[rnd.weighted({ none: 0.3, wipe: 0.35, fiber: 0.25, burnt: 0.1 })]
  const [haloR, rimWidth, rimAlpha, depth] = [
    rnd.u(1.5, 3),
    rnd.u(0.08, 0.28),
    rnd.u(0.4, 1),
    rnd.u(0, 0.3),
  ]
  return { backing, halo, haloR, rim, rimWidth, rimAlpha, depth, flap: rnd.pick([0, 0.15, 0.4]) }
}

/** A torn edge: the radius factor at angle `a`. */
function ragged(rnd: Rand, low: number, high: number): (a: number) => number {
  const [k1, p1, k2, p2] = [rnd.int(3, 6), rnd.angle(), rnd.int(7, 13), rnd.angle()]
  return (a) => 1 + low * Math.sin(k1 * a + p1) + high * Math.sin(k2 * a + p2)
}

/** The random shape of one hole of mean radius `rv` mm: torn edge, halo, radial tears, shadow side, folded flap. */
function holeShape({ rnd, paper }: Scene, rv: number, style: HoleStyle) {
  const edge = ragged(rnd, rnd.u(0, 0.12), rnd.u(0, 0.06))
  const halo =
    style.halo && rnd.chance(0.92)
      ? {
          r: rv * style.haloR * rnd.u(0.85, 1.15),
          shape: ragged(rnd, rnd.u(0.02, 0.1), rnd.u(0.03, 0.12)),
          color: rnd.color([style.halo], 8),
        }
      : undefined
  const back = shade(style.backing, rnd.u(0.85, 1.1))
  const tears = Array.from({ length: rnd.pick([0, 0, 1, 2, 3, 4]) }, () => ({
    a: rnd.angle(),
    length: rnd.u(0.3, 1.1) * rv,
    width: rnd.u(0.05, 0.12) * rv,
  }))
  const lit = rnd.angle()
  const flap = rnd.chance(style.flap)
    ? { a: rnd.angle(), offset: rnd.u(0.15, 0.8) * rv, color: shade(paper, rnd.u(0.72, 0.97)) }
    : undefined
  return { edge, halo, back, tears, lit, flap }
}

/** The two paint passes of one hole at photo point `c` with mean radius `rv` in face mm, drawn on the face plane so tilt makes it an ellipse: `around` the halo and rim, `inside` the radial tears, the backing with a shadow and a folded flap. Every hole's `around` runs before any `inside`, so a halo never covers a neighbor. */
function holePainter(scene: Scene, c: Point, rv: number, style: HoleStyle) {
  const { img, v } = scene
  const { edge, halo, back, tears, lit, flap } = holeShape(scene, rv, style)
  const center = v.toFace(c)
  const at = (x: number, y: number) => {
    const f = v.toFace({ x, y })
    const [dx, dy] = [f.x - center.x, f.y - center.y]
    const a = Math.atan2(dy, dx)
    return { dx, dy, d: Math.hypot(dx, dy), a, e: rv * edge(a) }
  }
  const tearAt = (dx: number, dy: number, t: (typeof tears)[number]) => {
    const along = dx * Math.cos(t.a) + dy * Math.sin(t.a)
    const across = Math.abs(-dx * Math.sin(t.a) + dy * Math.cos(t.a))
    const taper = t.width * clamp(1 - (along - rv) / t.length, 0, 1)
    return along > 0.5 * rv && along < rv + t.length ? cover((across - taper) * v.s) : 0
  }
  const reach = (4.5 * rv * v.s) / 0.8 + 3
  const around = (x: number, y: number, i: number) => {
    const { d, a, e } = at(x, y)
    if (halo) img.paint(i, cover((d - halo.r * halo.shape(a)) * v.s), halo.color)
    if (style.rim)
      img.paint(i, cover((d - e - style.rimWidth * rv) * v.s) * style.rimAlpha, style.rim)
  }
  const inside = (x: number, y: number, i: number) => {
    const { dx, dy, d, e } = at(x, y)
    const hole = Math.max(cover((d - e) * v.s), ...tears.map((t) => tearAt(dx, dy, t)))
    const side = clamp((dx * Math.cos(lit) + dy * Math.sin(lit)) / rv, -1, 1)
    img.paint(i, hole, shade(back, 1 - style.depth * side))
    if (!flap) return
    const beyond = dx * Math.cos(flap.a) + dy * Math.sin(flap.a) - flap.offset
    img.paint(i, cover(-beyond * v.s) * cover((d - e * 1.05) * v.s), flap.color)
  }
  return { around: () => img.each(around, c, reach), inside: () => img.each(inside, c, reach) }
}

/** One photo: the face, print and dirt, maybe the sheet's edge, the holes, then light, color cast, exposure and noise; blur and JPEG quality are drawn for the writer. */
export function synthesize(seed: number, index: number, options: SynthOptions): SynthPhoto {
  const rnd = new Rand((Math.imul(seed, 0x9e3779b1) + index) >>> 0)
  const { size } = options
  const D = rnd.u(...options.diameter)
  // a hole tears smaller than the bullet; the caliber sets the face's scale
  const v = view(rnd, size, D / (rnd.pick(CALIBERS) * rnd.u(0.6, 1)))
  const img = new Raster(size)
  const scene: Scene = { rnd, img, v, D, paper: rnd.color(PAPERS, 8) }
  img.each((_x, _y, i) => img.paint(i, 1, scene.paper))
  if (rnd.chance(0.5)) paperTexture(scene)
  const kind = rnd.weighted(KINDS)
  drawFace(scene, kind)
  drawMarks(scene, ['dark', 'reactive'].includes(kind) && rnd.chance(0.8))
  drawPatches(scene)
  const onSheet = rnd.chance(0.2) ? sheetEdge(scene) : () => true
  const style = holeStyle(scene, kind)
  const count = rnd.int(...options.holes)
  const holes = placeHoles(scene, count, onSheet)
  if (holes.length < count)
    throw new Error(
      `photo ${index}: ${holes.length} of ${count} holes fit; use a larger size or smaller diameters or counts`,
    )
  const painters = [...holes, ...cutHoles(scene)].map((c) =>
    holePainter(scene, c, (D / 2 / v.s) * rnd.u(0.92, 1.08), style),
  )
  for (const p of painters) p.around()
  for (const p of painters) p.inside()
  lighting(scene)
  const [blur, jpeg] = [rnd.chance(0.8) ? rnd.u(0.3, 1.5) : 0, rnd.int(40, 95)]
  return {
    kind,
    size,
    rgb: Uint8ClampedArray.from(img.px),
    blur,
    jpeg,
    visibleDiameterPx: D,
    holes,
  }
}

/** `count` hole centers inside the photo and on the sheet, a third of them next to an earlier hole as in a group, none closer than 0.4 diameters. */
function placeHoles(scene: Scene, count: number, onSheet: (p: Point) => boolean): Point[] {
  const { rnd, D } = scene
  const last = scene.img.size - 1
  const centers: Point[] = []
  const fits = (c: Point) =>
    c.x >= 0 &&
    c.x <= last &&
    c.y >= 0 &&
    c.y <= last &&
    onSheet(c) &&
    centers.every((o) => Math.hypot(c.x - o.x, c.y - o.y) > 0.4 * D)
  const candidate = (): Point => {
    const near = centers.length > 0 && rnd.chance(0.35) ? rnd.pick(centers) : undefined
    const [a, dist] = [rnd.angle(), rnd.u(0.4, 1.3) * D]
    return near
      ? { x: near.x + dist * Math.cos(a), y: near.y + dist * Math.sin(a) }
      : { x: rnd.u(0, last), y: rnd.u(0, last) }
  }
  for (let n = 0; n < count; n++) {
    const c = Array.from({ length: 100 }, candidate).find(fits)
    if (c) centers.push(c)
  }
  return centers
}

/** Holes cut by the photo's edge, left unlabeled as their centers lie outside. */
function cutHoles({ rnd, img, D }: Scene): Point[] {
  const last = img.size - 1
  return Array.from({ length: rnd.pick([0, 0, 1, 2]) }, () => {
    const [along, out] = [rnd.u(0, last), rnd.u(0.05, 0.45) * D]
    return rnd.pick([
      { x: along, y: -out },
      { x: along, y: last + out },
      { x: -out, y: along },
      { x: last + out, y: along },
    ])
  })
}

function paperTexture({ rnd, img }: Scene): void {
  const n = Math.ceil(img.size / 8) + 2
  const low = Array.from({ length: n * n }, () => rnd.normal())
  const at = (gx: number, gy: number) => defined(low[gy * n + gx])
  const amount = rnd.u(0.01, 0.05)
  img.each((x, y, i) => {
    const [gx, gy] = [Math.floor(x / 8), Math.floor(y / 8)]
    const [fx, fy] = [x / 8 - gx, y / 8 - gy]
    const top = (1 - fx) * at(gx, gy) + fx * at(gx + 1, gy)
    const bottom = (1 - fx) * at(gx, gy + 1) + fx * at(gx + 1, gy + 1)
    const f = 1 + amount * ((1 - fy) * top + fy * bottom)
    for (let k = 0; k < 3; k++) img.px[3 * i + k] = defined(img.px[3 * i + k]) * f
  })
}

/** Paints the sheet's edge with its shadow and the table or board beside it; returns whether a point lies on the sheet clear of the edge. */
function sheetEdge({ rnd, img, D }: Scene): (p: Point) => boolean {
  const [a, shift, half] = [rnd.angle(), rnd.u(0.05, 0.45) * img.size, img.size / 2]
  const off = (p: Point) => (p.x - half) * Math.cos(a) + (p.y - half) * Math.sin(a) - shift
  const table = rnd.color(TABLES, 12)
  img.each((x, y, i) => {
    const d = off({ x, y })
    img.paint(i, cover(-d), shade(table, 1 + 0.08 * rnd.normal()))
    // the sheet's shadow falls on its own edge band, the table side stays lit
    img.paint(i, cover(-d - 3) * cover(d) * 0.35, [0, 0, 0])
  })
  return (p) => off(p) < -0.6 * D
}

/** A light gradient, sometimes a shadow edge, exposure, a color cast, a tone curve and sensor noise. */
function lighting({ rnd, img }: Scene): void {
  const half = img.size / 2
  const along = (a: number, x: number, y: number) =>
    ((x - half) * Math.cos(a) + (y - half) * Math.sin(a)) / img.size
  const [ga, fall] = [rnd.angle(), rnd.u(0, 0.4)]
  const shadow = rnd.chance(0.2)
    ? {
        a: rnd.angle(),
        at: rnd.u(-0.3, 0.3),
        soft: rnd.u(2, 20) / img.size,
        dim: rnd.u(0.15, 0.45),
      }
    : undefined
  const exposure = rnd.u(0.6, 1.1)
  const cast = [rnd.u(0.95, 1.05), rnd.u(0.95, 1.05), rnd.u(0.95, 1.05)]
  const [gamma, noise] = [rnd.u(0.75, 1.35), rnd.u(1, 8)]
  img.each((x, y, i) => {
    let f = (1 - fall * (along(ga, x, y) + 0.5)) * exposure
    if (shadow)
      f *= 1 - shadow.dim * clamp((along(shadow.a, x, y) - shadow.at) / shadow.soft + 0.5, 0, 1)
    for (let k = 0; k < 3; k++) {
      const lit = clamp((defined(img.px[3 * i + k]) * f * defined(cast[k])) / 255, 0, 1)
      img.px[3 * i + k] = 255 * lit ** gamma + noise * rnd.normal()
    }
  })
}
