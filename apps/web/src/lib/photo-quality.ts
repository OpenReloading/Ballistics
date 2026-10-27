/**
 * Quality of a target photo for hole detection (`apps/docs/docs/models/hole-detection.md`, Photo
 * quality): tilt, contrast, exposure, sharpness, resolution, framing, glare and uneven light,
 * measured on the photo, on the black area the face search found when there is one, and on the
 * edges of the photo when there is not: a target may have no black area, or no unfilled paper. Each problem comes with a level and a plain
 * sentence on what to change when retaking the photo. The check says what the photo makes hard for
 * detection, never that a detection is right. Pure: no React, DOM or Next.js.
 */
import { fromSi, type TargetFace } from '@open-reloading/schema'
import type { Ellipse } from './ellipse.ts'
import { grayGrid, shareInside } from './face-image.ts'
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import { clamp } from './raster-ops.ts'

/** What is wrong with the photo. */
type QualityProblem =
  | 'face'
  | 'tilt'
  | 'contrast'
  | 'exposure'
  | 'blur'
  | 'glare'
  | 'shadow'
  | 'resolution'
  | 'framing'

/** `bad` is below the minimum quality: detection is held until the user goes on; `fair` is a note. */
type QualityLevel = 'fair' | 'bad'

export type QualityIssue = {
  problem: QualityProblem
  level: QualityLevel
  /** What the photo shows, one sentence. */
  text: string
  /** What to change when retaking it, one sentence. */
  fix: string
}

/**
 * What a selected target says about the photo, as a hint: the photo may show only its centre or cut
 * through its rings, so only the presence of a black zone is used, never a ring, a size or an extent.
 */
export type TargetLayout = {
  /** Whether the target has a black zone; absent when the record does not give the zone colours. */
  dark?: boolean | undefined
}

/** The layout of a target face record: a black zone when a ring's fill is black, none when every fill is given and none is. No record: no layout. */
export function layoutOf(face: Pick<TargetFace, 'rings'> | undefined): TargetLayout | undefined {
  if (!face) return undefined
  const fills = face.rings.flatMap((r) => (r.fill ? [r.fill] : []))
  if (fills.includes('black')) return { dark: true }
  return { dark: fills.length === face.rings.length ? false : undefined }
}

/** The photo as the face search saw it: `image` is the photo resized by `scale` (image px per photo px). */
type PhotoView = {
  image: RgbaImage
  scale: number
  /** The black area found, image px; absent when none was. */
  black?: Ellipse | undefined
  /** The hole diameter on `image`, px, from the scale of the face found; absent when no face fit. */
  holePx?: number | undefined
  /** The selected target's layout, or the one of the face found for sure; absent: no target known. */
  layout?: TargetLayout | undefined
}

/** Grey levels of the grid the photo is judged on: its longer side in blocks. */
const GRID = 700

/** Fair and bad limits per measure; the first number is the fair limit. */
const limits = {
  /** Tilt of the black area's plane, degrees (arccos of its axis ratio). */
  tilt: [30, 55],
  /** Paper over black area, grey levels (below). */
  contrast: [80, 45],
  /** Brightest part of the photo, grey levels (below). */
  exposure: [90, 50],
  /** Width of the black area's edge in holes (above). */
  blur: [0.3, 0.6],
  /** Share of saturated paper (above). */
  glare: [0.04, 0.15],
  /** Largest relative difference of the paper's grey level between the four sides (above). */
  shadow: [0.25, 0.45],
  /** Hole diameter on the photo, px (below). */
  resolution: [6, 3.5],
  /** Share of the black area inside the photo (below). */
  framing: [0.9, 0.5],
} as const

/** A limit pair with the bad limit above the fair one is passed by a higher value, else by a lower one. */
const levelOf = (
  value: number,
  [fair, bad]: readonly [number, number],
): QualityLevel | undefined => {
  const past = (limit: number) => (bad > fair ? value > limit : value < limit)
  if (past(bad)) return 'bad'
  return past(fair) ? 'fair' : undefined
}

/** Median of the numbers in `v`, NaN when it has none (a bin no ray reached is NaN and left out). */
function median(v: readonly number[]): number {
  const s = v.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)
  return s.length ? nth(s, s.length >> 1) : Number.NaN
}

/** Position of a point relative to an ellipse: 1 on its edge, 0 at its middle. */
function ellipseRadius(e: Ellipse, x: number, y: number): number {
  const [dx, dy] = [x - e.centreX, y - e.centreY]
  const [c, s] = [Math.cos(e.angle), Math.sin(e.angle)]
  return Math.hypot((c * dx + s * dy) / e.semiMajor, (-s * dx + c * dy) / e.semiMinor)
}

function lumaAt({ width, height, data }: RgbaImage, x: number, y: number): number {
  const [xc, yc] = [clamp(x, 0, width - 1), clamp(y, 0, height - 1)]
  const [i, j] = [Math.min(width - 2, Math.floor(xc)), Math.min(height - 2, Math.floor(yc))]
  const [fx, fy] = [xc - i, yc - j]
  const at = (a: number, b: number) => {
    const k = (b * width + a) * 4
    return 0.299 * nth(data, k) + 0.587 * nth(data, k + 1) + 0.114 * nth(data, k + 2)
  }
  return (
    at(i, j) * (1 - fx) * (1 - fy) +
    at(i + 1, j) * fx * (1 - fy) +
    at(i, j + 1) * (1 - fx) * fy +
    at(i + 1, j + 1) * fx * fy
  )
}

/** Median grey level of the first and of the last quarter of a profile. */
const ends = (p: readonly number[]): [number, number] => [
  median(p.slice(0, p.length >> 2)),
  median(p.slice(p.length - (p.length >> 2))),
]

/** Index of the steepest rise of `p` between a quarter and three quarters of its length, and the rise per sample. */
function steepestRise(p: readonly number[]): { at: number; rise: number } {
  const [from, to] = [p.length >> 2, p.length - (p.length >> 2)]
  let [at, rise] = [p.length >> 1, 0]
  for (let i = from; i < to; i++) {
    const g = (nth(p, i + 1) - nth(p, i - 1)) / 2
    if (g > rise) [at, rise] = [i, g]
  }
  return { at, rise }
}

/** Grey levels along the outward normal of the ellipse at parameter `t`, `n` samples `step` px apart about its edge. */
function normalProfile(image: RgbaImage, e: Ellipse, t: number, n: number, step: number) {
  const [c, s] = [Math.cos(e.angle), Math.sin(e.angle)]
  const [u, v] = [e.semiMajor * Math.cos(t), e.semiMinor * Math.sin(t)]
  const [nu, nv] = [Math.cos(t) / e.semiMajor, Math.sin(t) / e.semiMinor]
  const [nx, ny] = [c * nu - s * nv, s * nu + c * nv]
  const nl = Math.hypot(nx, ny)
  return Array.from({ length: n }, (_, i) => {
    const o = (i - (n >> 1)) * step
    return lumaAt(
      image,
      e.centreX + c * u - s * v + (nx / nl) * o,
      e.centreY + s * u + c * v + (ny / nl) * o,
    )
  })
}

/** The profile averaged over 5 samples. */
const smooth = (p: readonly number[]) =>
  p.map((_, i) => {
    const w = p.slice(Math.max(0, i - 2), i + 3)
    return w.reduce((a, b) => a + b, 0) / w.length
  })

/**
 * Width of the black area's edge in image px: the profile across the edge on 120 rays along the
 * ellipse's normals, aligned at each ray's steepest point and averaged, then the grey step over the
 * steepest slope (the 10 to 90 % width of a Gaussian edge, up to a factor of 1). Undefined when the
 * rays show no step.
 */
function edgeWidth(image: RgbaImage, e: Ellipse): number | undefined {
  const [span, step, rays] = [clamp(0.1 * ((e.semiMajor + e.semiMinor) / 2), 6, 30), 0.25, 120]
  const n = Math.round((2 * span) / step) + 1
  const [sum, count] = [new Float64Array(n), new Float64Array(n)]
  let used = 0
  for (let k = 0; k < rays; k++) {
    const p = normalProfile(image, e, (2 * Math.PI * k) / rays, n, step)
    const [lo, hi] = ends(p)
    // the black area is darker inside than outside
    if (hi - lo < 25) continue
    const shift = (n >> 1) - steepestRise(smooth(p)).at
    p.forEach((g, i) => {
      const j = i + shift
      if (j < 0 || j >= n) return
      sum[j] = nth(sum, j) + g
      count[j] = nth(count, j) + 1
    })
    used++
  }
  if (used < rays / 4) return undefined
  // bins that fewer than half of the rays reach are left out
  const avg = Array.from({ length: n }, (_, i) =>
    nth(count, i) >= used / 2 ? nth(sum, i) / nth(count, i) : Number.NaN,
  )
  const [lo, hi] = ends(avg)
  const { rise } = steepestRise(avg)
  return rise > 0 && hi > lo ? (hi - lo) / (rise / step) : undefined
}

type Spot = { g: number; x: number; y: number }

/** The grey blocks inside the black area (below 0.8 radii) and in the ring of paper around it (1.12 to 1.4). */
function aroundBlack(grid: ReturnType<typeof grayGrid>, black: Ellipse, s: number) {
  const inside: number[] = []
  const ring: Spot[] = []
  for (let i = 0; i < grid.grey.length; i++) {
    const [x, y] = [(i % grid.width) * s + s / 2, Math.floor(i / grid.width) * s + s / 2]
    const rho = ellipseRadius(black, x, y)
    if (rho < 0.8) inside.push(nth(grid.grey, i))
    else if (rho >= 1.12 && rho <= 1.4) ring.push({ g: nth(grid.grey, i), x, y })
  }
  return { inside, ring }
}

/** Largest relative difference between four sides' grey levels; undefined with fewer than three sides. */
function sidesDifference(levels: readonly number[]): number | undefined {
  const sides = levels.filter((v) => !Number.isNaN(v))
  const top = Math.max(...sides)
  return sides.length >= 3 && top > 0 ? (top - Math.min(...sides)) / top : undefined
}

/** The ring's four sides, left and right, above and below the centre, by their median grey level. */
const ringSides = (ring: readonly Spot[], at: Ellipse) =>
  [0, 1, 2, 3].map((k) =>
    median(
      ring
        .filter((p) => (p.x >= at.centreX ? 1 : 0) + (p.y >= at.centreY ? 2 : 0) === k)
        .map((p) => p.g),
    ),
  )

const quantileOf = (v: readonly number[], p: number) => {
  const s = [...v].sort((a, b) => a - b)
  return s.length ? nth(s, Math.min(s.length - 1, Math.floor(p * s.length))) : Number.NaN
}

/** Grey level that counts as lit paper. */
const LIT = 120

/**
 * The 90th percentile of each quarter of the photo, the paper level of a target of any pattern;
 * undefined when fewer than three quarters show lit paper (the photo may be filled by a black zone).
 */
function quarterLight(grid: ReturnType<typeof grayGrid>): number | undefined {
  const parts: number[][] = [[], [], [], []]
  grid.grey.forEach((g, i) => {
    const [x, y] = [i % grid.width, Math.floor(i / grid.width)]
    parts[(x * 2 >= grid.width ? 1 : 0) + (y * 2 >= grid.height ? 2 : 0)]?.push(g)
  })
  const levels = parts.map((q) => quantileOf(q, 0.9))
  return levels.filter((v) => v >= LIT).length >= 3 ? sidesDifference(levels) : undefined
}

/**
 * Contrast, brightness, glare and uneven light on the grey grid. With a black area: its darkest
 * fifth against the paper just around it (a white zone inside it does not count), glare as
 * saturated paper, the four sides of that ring for the light. Without one, or with its ring out of
 * the frame, the brightness of the photo (95th percentile), its darkest 5 % and its quarters for
 * the light, whatever the pattern of the target.
 */
function gridMeasures(image: RgbaImage, black: Ellipse | undefined, s: number) {
  const grid = grayGrid(image, s)
  const whole = Array.from(grid.grey)
  const { inside, ring } = black ? aroundBlack(grid, black, s) : { inside: [], ring: [] }
  const paper = black && ring.length ? ring.map((p) => p.g) : whole
  const step =
    quantileOf(
      ring.map((p) => p.g),
      0.75,
    ) - quantileOf(inside, 0.2)
  // saturated paper against paper that is lit: an all white photo is not glare
  const lit = paper.filter((g) => g >= LIT)
  const open = lit.filter((g) => g < 250)
  return {
    contrast: Number.isNaN(step) ? undefined : step,
    exposure: quantileOf(whole, 0.95),
    dark: quantileOf(whole, 0.05),
    glare: lit.length && median(open) <= 232 ? (lit.length - open.length) / lit.length : 0,
    shadow: black && ring.length ? sidesDifference(ringSides(ring, black)) : quarterLight(grid),
  }
}

/** The grey step of a profile over its steepest slope, px; undefined when the step is below 40 grey levels. */
function stepWidth(p: readonly number[], step: number): number | undefined {
  const [lo, hi] = ends(p)
  if (Math.abs(hi - lo) < 40) return undefined
  // the profile rises along the gradient; a falling one is turned over
  const { rise } = steepestRise(hi > lo ? p : p.map((v) => -v))
  return rise > 0 ? Math.abs(hi - lo) / (rise / step) : undefined
}

/**
 * Width in image px of the sharpest edges of the photo, whatever the target: at the 6000 points of
 * strongest grey gradient (on a lattice of 3 px) the profile across the edge, the grey step over the
 * steepest slope, the median over the points whose step is at least 40 grey levels. Thin lines are
 * left out by that step, so a photo of rings alone, with no hole, gives no measure. Undefined when fewer than 20 points qualify: the photo shows no edge.
 */
function edgeSharpness(image: RgbaImage, hole: number): number | undefined {
  const { width, height } = image
  const [span, step] = [clamp(0.75 * hole, 6, 30), 0.5]
  const n = Math.round((2 * span) / step) + 1
  const points: Array<{ x: number; y: number; gx: number; gy: number; g: number }> = []
  for (let y = 2; y < height - 2; y += 3)
    for (let x = 2; x < width - 2; x += 3) {
      const gx = (lumaAt(image, x + 1, y) - lumaAt(image, x - 1, y)) / 2
      const gy = (lumaAt(image, x, y + 1) - lumaAt(image, x, y - 1)) / 2
      const g = Math.hypot(gx, gy)
      if (g >= 3) points.push({ x, y, gx, gy, g })
    }
  points.sort((a, b) => b.g - a.g)
  const widths: number[] = []
  for (const { x, y, gx, gy, g } of points.slice(0, 6000)) {
    const p = smooth(
      Array.from({ length: n }, (_, i) =>
        lumaAt(image, x + (gx / g) * (i - (n >> 1)) * step, y + (gy / g) * (i - (n >> 1)) * step),
      ),
    )
    const w = stepWidth(p, step)
    if (w !== undefined) widths.push(w)
    if (widths.length >= 300) break
  }
  return widths.length >= 20 ? median(widths) : undefined
}

type Add = (
  problem: keyof typeof limits,
  value: number,
  text: (level: QualityLevel) => string,
  fix: string,
  limit?: readonly [number, number],
) => void

/** Contrast or brightness, glare and uneven light. */
function lightIssues(
  add: Add,
  m: ReturnType<typeof gridMeasures>,
  layout: TargetLayout | undefined,
) {
  if (m.contrast !== undefined)
    add(
      'contrast',
      m.contrast,
      () => 'The black area and the paper are close in brightness.',
      'Retake with more light on the target and without a photo filter.',
    )
  else if (layout?.dark === true)
    // the target has a black zone and the photo may be filled with it: judge the black itself
    add(
      'contrast',
      m.dark,
      () => 'The black zones of the target look grey.',
      'Retake with less light on the target, without a reflection and without a photo filter.',
      [110, 150],
    )
  // a dark photo may show a black zone alone, so only a target without one makes this a bad level
  else
    add(
      'exposure',
      m.exposure,
      () => 'The photo is dark: even its brightest part is dim.',
      'Retake with more light on the target and without a photo filter.',
      layout?.dark === false ? limits.exposure : [limits.exposure[0], 0],
    )
  add(
    'glare',
    m.glare,
    () => 'A bright reflection covers part of the paper.',
    'Retake with the light from the side, or turn the sheet a little to move the reflection off the target.',
  )
  if (m.shadow !== undefined)
    add(
      'shadow',
      m.shadow,
      () => 'The light is uneven: one side of the target is much darker than another.',
      'Retake in an even light with no shadow of your hand or phone on the sheet.',
    )
}

/**
 * Tilt and framing of the black area. A black area cut by the frame gives no tilt, and with a
 * known target no framing note: the photo may show only its centre or cut through its rings.
 */
function shapeIssues(add: Add, black: Ellipse, image: RgbaImage, layout: TargetLayout | undefined) {
  const framed = shareInside(black, image.width, image.height)
  if (framed >= limits.framing[0]) {
    const tilt = fromSi('angle', Math.acos(clamp(black.semiMinor / black.semiMajor, 0, 1)))
    add(
      'tilt',
      tilt,
      () => `The target is photographed at a slant of about ${Math.round(tilt)} degrees.`,
      'Retake from straight above, with the camera parallel to the paper.',
    )
  }
  if (!layout)
    add(
      'framing',
      framed,
      () => 'The black area of the target is cut off by the edge of the photo.',
      'Retake with the whole target and some paper around it in the frame.',
    )
}

/**
 * The problems of the photo that make hole detection harder, the worst first, each with how to
 * retake it. Empty when none of the measures is past its limit; that is no statement that the
 * holes will be found right.
 */
export function photoQuality(view: PhotoView): QualityIssue[] {
  const { image, scale, black, holePx, layout } = view
  const issues: QualityIssue[] = []
  const add: Add = (
    problem: keyof typeof limits,
    value: number,
    text: (level: QualityLevel) => string,
    fix: string,
    limit: readonly [number, number] = limits[problem],
  ) => {
    const level = levelOf(value, limit)
    if (level) issues.push({ problem, level, text: text(level), fix })
  }
  const long = Math.max(image.width, image.height)
  const s = Math.max(1, Math.ceil(long / GRID))
  const m = gridMeasures(image, black, s)
  // without a face's scale a hole is taken as 6 % of the black area's diameter, else of the photo's 1/80
  const hole = holePx ?? (black ? 0.06 * (black.semiMajor + black.semiMinor) : long / 80)
  if (black) shapeIssues(add, black, view.image, layout)
  const width = (black && edgeWidth(image, black)) || edgeSharpness(image, hole)
  if (width !== undefined)
    add(
      'blur',
      width / hole,
      () => 'The photo is soft: the edges of the target are blurred.',
      'Hold the camera steady or rest it on something, let it focus on the target and retake.',
    )
  if (black) {
    const px = hole / scale
    add(
      'resolution',
      px,
      () => `A bullet hole is only about ${Math.max(1, Math.round(px))} px across in this photo.`,
      'Move closer so the target fills more of the frame, or use the full resolution of the camera.',
    )
  } else {
    if (width === undefined)
      issues.push({
        problem: 'face',
        level: 'bad',
        text: 'No edge of a target or a hole was found in this photo.',
        fix: 'Retake with the target in the frame, in even light and held steady, or set the scale by hand.',
      })
    const longPhoto = long / scale
    add(
      'resolution',
      longPhoto / 80,
      () => `The photo is only ${Math.round(longPhoto)} px on its longer side.`,
      'Move closer so the target fills more of the frame, or use the full resolution of the camera.',
    )
  }
  lightIssues(add, m, layout)
  return issues.sort((a, b) => Number(b.level === 'bad') - Number(a.level === 'bad'))
}

/** Whether the photo is below the minimum quality: at least one problem at the bad level. */
export const belowMinimum = (issues: readonly QualityIssue[]): boolean =>
  issues.some((i) => i.level === 'bad')
