/**
 * Bullet hole proposals on a target photo (`apps/docs/docs/models/hole-detection.md`): a colour axis from one
 * example hole (Fisher's linear discriminant of the hole against the ring around it, in log RGB),
 * a multi-scale Hessian blob detector on the projection, a top-hat against a 2 D opening for the
 * hole shape, and a count per connected part from its peaks and its area. Pure: no React, DOM or
 * Next.js, so it can run in a Web Worker.
 */
import {
  boxBlur,
  type Peak,
  peaksOf,
  radiiOf,
  type Space,
  sigmaAt,
  space,
} from './blob-detector.ts'
import {
  axisOf,
  DISC,
  type LogRgb,
  logLuma,
  lumaOf,
  project,
  rescale,
  type Seed,
  type WorkImage,
} from './colour-axis.ts'
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import {
  clamp,
  components,
  distanceSquared,
  insidePolygon,
  median1,
  open,
  rectangle,
} from './raster-ops.ts'
import type { Point } from './target-geometry.ts'
import { paperOutline } from './target-paper.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const f32 = (a: Float32Array, i: number) => a[i] as number
const f64 = (a: Float64Array, i: number) => a[i] as number
const i32 = (a: Int32Array, i: number) => a[i] as number
const u8 = (a: Uint8Array | Uint8ClampedArray, i: number) => a[i] as number

/** A polygon or a rectangle in image px. */
export type Region = readonly Point[] | { x: number; y: number; width: number; height: number }

export type HoleDetectionInput = {
  image: RgbaImage
  region?: Region
  /** Image px per m of the target near the region. */
  pxPerM: number
  /** Expected hole diameter, m (the bullet diameter, a typed or a learned hole size). */
  expectedHoleDiameter: number
  /**
   * Unitless sensitivity, default 0.15: the peak strength cutoff (`KEEP` times `minContrast / 0.15` of
   * the median of the 5 strongest peaks, held to 0.05 to 0.9) and the least colour separation
   * (`MIN_SEP` times `minContrast / 0.15`) scale with it.
   */
  minContrast?: number
  /** Visible hole diameter over the bullet diameter. */
  holeScale?: number
  /**
   * Colour seen through a hole (0..255 per channel), picked by the user in one hole: the colour
   * axis runs from the surroundings of the region to it. Absent: the axis comes from the strongest
   * blobs of the region (`autoDetect`).
   */
  backing?: { r: number; g: number; b: number }
  /** Holes darker (`dark`) or lighter (`light`) than their surroundings only; absent: both. */
  polarity?: 'dark' | 'light'
  /** Called with the share of the work done, 0..1, between the steps. */
  onProgress?: (done: number) => void
  /**
   * The target face found on the photo: its outline is the region when
   * none is given, the colour axis of a hole takes its surroundings from the same kind of surface
   * (black area or paper), and a run drops what its polarity cannot show: dark marks on the black
   * area and light marks on the paper are print.
   */
  face?: FaceLabel | undefined
}

/** The printed face as the detection sees it. */
export type FaceLabel = {
  /** Polygon of the outermost ring, image px, grown by what a hole at its edge needs. */
  outline: Point[]
  /** True for a point on the black area. */
  black: (p: Point) => boolean
  /**
   * True for a point where the ring numerals stand: on an axis turned by `roll` (rad), between two
   * ring lines.
   */
  numeral?: ((p: Point, roll?: number) => boolean) | undefined
  /** Distance of a point from the face centre (mm) and its angle from the face's x axis (rad). */
  polar?: (p: Point) => { radius: number; angle: number }
}

export type HoleProposal = {
  /** Image px. */
  x: number
  y: number
  /** Peak response over the median response of the 5 strongest peaks, capped at 1. */
  confidence: number
  /** Shots counted in the cluster this proposal belongs to. */
  clusterSize: number
  clusterId: number
  /** Image px: diameter of a disc of the cluster's area over its shot count. */
  diameter: number
}

/** A region the detector cannot count (image px); the editor draws it as "place by hand". */
export type FlaggedRegion = {
  x: number
  y: number
  width: number
  height: number
  holeAreas: number
}

/** Hole diameter in working px the photo is averaged to (about; a hole is 4 to 24 px). */
export const WORK_DIAMETER = 16
/** Most working px of a region: larger blocks keep memory and time bounded on a large photo. */
export const MAX_WORK_PIXELS = 2_000_000
/** Least hole diameter in working px once the cap forces larger blocks. */
const MIN_WORK_DIAMETER = 4

/**
 * Image px per working px (block size) for a crop of `width` x `height` px with holes `holePx`
 * across; a RangeError when the cap leaves a hole fewer than 4 working px.
 */
export function workBlockSize(
  holePx: number,
  width: number,
  height: number,
  work = WORK_DIAMETER,
): number {
  const s = Math.max(
    1,
    Math.round(holePx / work),
    Math.ceil(Math.sqrt((width * height) / MAX_WORK_PIXELS)),
  )
  if (holePx / s < MIN_WORK_DIAMETER)
    throw new RangeError('The region is too large for holes this small; mark a smaller region')
  return s
}

type Found = { proposals: HoleProposal[]; flagged: FlaggedRegion[]; holeDiameter: number }

/** The hole size of a run stays within these multiples of the expected size. */
const SIZE_MIN = 0.7
const SIZE_MAX = 1.4
/** Blob scales (sigma over the hole diameter D), and the wider set that sizes a picked hole. */
const SIGMAS = [0.12, 0.17, 0.24, 0.34]
const WIDE = [0.12, 0.17, 0.24, 0.34, 0.48]
/** A disc of radius r peaks the scale-normalised Hessian at sigma = r / sqrt 2: D = 2 sqrt 2 sigma. */
const D_OVER_SIGMA = 2 * Math.SQRT2
/** Peak tests (own thresholds, a starting point from a prototype): strength against the strongest, inscribed radius, fill share. */
const KEEP = 0.35
const INSCRIBED = 0.2
const FILL = 0.3
/** The top-hat is thresholded at this share of the median contrast of the 5 strongest peaks. */
const HAT = 0.35
/** Least separation of a hole from its ring along the colour axis, in log RGB units. */
const MIN_SEP = 0.02
/** The opening of the top-hat runs on the working image shrunk by this factor. */
const OPEN_SHRINK = 2
/** Least top-hat contrast of a peak, on the scale where the picked hole stands 128 above its ring. */
const FLOOR = 40
/** A part whose area per peak is more than a disc of this many D across is print, not holes. */
const MAX_PART = 3
/** With a face, a mark of the wrong polarity for its surface is dropped unless its confidence reaches this. */
const PRINT_CONFIDENCE = 0.8
/** Marks where the ring numerals stand that make a run's marks there print: fewer are holes. */
const NUMERALS_MIN = 3
/** Marks on the turned axes agree on the turn within this angle, rad (2 degrees). */
const ROLL_SPREAD = Math.PI / 90
/** Peaks of the auto run per polarity that seed a run. */
const AUTO_SEEDS = 4

/** Shots of a run, in work px. */
type Run = {
  shots: HoleProposal[]
  /** Hole diameter the strongest peaks show, work px (before the clamp). */
  size: number
  /** Their diameters, work px. */
  sizes: number[]
  mu: LogRgb
  ring: LogRgb
  /** The shots where the ring numerals stand (a face label with rings), also in `shots`. */
  zone?: HoleProposal[]
}
type Ctx = WorkImage & {
  blockSize: number
  x0: number
  y0: number
  poly: Point[]
  /** Expected hole diameter, work px. */
  prior: number
  keep: number
  progress: (done: number) => void
  face?: FaceLabel | undefined
}
/** A seed run of the auto detection. */
type SeedRun = { found: Found; run: Run; at: Point; holeDiameter: number }

export type HoleExample = {
  /** Visible hole diameter, image px. */
  diameter: number
  /** The hole's colour. */
  backing: { r: number; g: number; b: number }
  /** Darker or lighter than its surroundings. */
  polarity: 'dark' | 'light'
}

/**
 * Hole proposals without a picked hole: with a backing colour the colour axis runs from the
 * region's surroundings to it, else `autoDetect`'s.
 */
export function findHoles(input: HoleDetectionInput): {
  proposals: HoleProposal[]
  flagged: FlaggedRegion[]
} {
  const found = input.backing ? solved(input, undefined)?.found : autoDetect(input)
  return { proposals: found?.proposals ?? [], flagged: [] }
}

/**
 * Detection without a picked hole (`apps/docs/docs/models/hole-detection.md`, "Detection without a picked hole"): the strongest blobs of
 * each polarity seed a colour axis, and the run with the most shots is proposed when its holes are
 * alike (at least 2, sizes within 35 % of their median). Undefined otherwise: the user picks a hole.
 */
export function autoDetect(raw: HoleDetectionInput): Found | undefined {
  // the coarse and the full pass each report from 0: only the rises count
  let seen = 0
  const input = {
    ...raw,
    // with a face its outline is the region (`prepare` cuts it to the sheet)
    ...(!raw.region && !raw.face && { region: paperOutline(raw.image) }),
    onProgress: (done: number) => {
      if (done <= seen) return
      seen = done
      raw.onProgress?.(done)
    },
  }
  // the seeds are tried on a copy with holes of 12 px, the winner on the full one (16 px)
  const ctx = prepare(input, 0.75 * WORK_DIAMETER)
  if (!ctx) return undefined
  const runs = runSeeds(input, ctx, seedPeaks(ctx, input.polarity))
  const printed = dropNumeralMarks(runs, ctx.prior)
  const best = chooseAgreeingRun(runs, ctx)
  const again = best && refineWinner(input, ctx, best, printed)
  ctx.progress(1)
  return again?.found ?? best?.found
}

/** The strongest blobs of the log luma per polarity, the strongest of each polarity first. */
function seedPeaks(ctx: Ctx, polarity: HoleDetectionInput['polarity']): (Peak | undefined)[] {
  const lum = logLuma(ctx)
  const sides = polarity ? [polarity] : (['dark', 'light'] as const)
  const peaks = sides.map((side) => {
    const sign = side === 'dark' ? -1 : 1
    const P = rescale(
      Float32Array.from(lum, (v) => sign * v),
      ctx.inside,
    )
    const scales = space(P, ctx.w, ctx.h, radiiOf(ctx.prior, SIGMAS))
    return peaksOf(scales, ctx.inside, ctx.prior).slice(0, AUTO_SEEDS)
  })
  return Array.from({ length: AUTO_SEEDS }, (_, k) => peaks.map((p) => p[k])).flat()
}

/** A run per seed whose strongest peaks show alike holes (at least 2 shots). */
function runSeeds(input: HoleDetectionInput, ctx: Ctx, seeds: (Peak | undefined)[]): SeedRun[] {
  const runs: SeedRun[] = []
  for (const [i, peak] of seeds.entries()) {
    if (!peak) continue
    ctx.progress(0.1 + (0.9 * i) / seeds.length)
    const at = { x: peak.x, y: peak.y }
    const got = solved(input, at, ctx, false, false)
    if (!got || got.run.shots.length < 2) continue
    const sizes = [...got.run.sizes].sort((a, b) => a - b)
    // no sizes: NaN, as arithmetic on a missing entry has it
    const mid = sizes[sizes.length >> 1] ?? Number.NaN
    // the strongest peaks show alike holes
    if (sizes.filter((v) => Math.abs(v / mid - 1) > 0.35).length > sizes.length / 4) continue
    runs.push({ ...got, at })
  }
  return runs
}

/**
 * Whether the marks in the numeral zone are print: they stand at three places or more over all the
 * runs. Then they leave the shots of every run.
 */
function dropNumeralMarks(runs: SeedRun[], prior: number): boolean {
  const spots: Point[] = []
  for (const r of runs)
    for (const z of r.run.zone ?? [])
      if (!spots.some((q) => Math.hypot(q.x - z.x, q.y - z.y) <= 0.5 * prior)) spots.push(z)
  const printed = spots.length >= NUMERALS_MIN
  if (printed)
    for (const r of runs)
      r.run = { ...r.run, shots: r.run.shots.filter((q) => !r.run.zone?.includes(q)) }
  return printed
}

/** The run whose shots most other runs find again: print and stains differ from seed to seed. */
function chooseAgreeingRun(runs: SeedRun[], ctx: Ctx): (SeedRun & { score: number }) | undefined {
  const agree = (a: Run, b: Run) =>
    a.shots.filter((p) => b.shots.some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= 0.5 * ctx.prior))
      .length
  let best: (SeedRun & { score: number }) | undefined
  for (const r of runs) {
    const score = runs.reduce((sum, o) => (o === r ? sum : sum + agree(r.run, o.run)), 0)
    // with a face the numerals no longer pad the runs, so equal agreement is common: more shots
    const tie =
      ctx.face && best && score === best.score && r.run.shots.length > best.run.shots.length
    if (score > 0 && (!best || score > best.score || tie)) best = { ...r, score }
  }
  return best
}

/** The winner on the full working image, with the size its strongest peaks show. */
function refineWinner(input: HoleDetectionInput, ctx: Ctx, best: SeedRun, printed: boolean) {
  const fine = prepare(input)
  return fine && solved(input, fromImage(fine, toImage(ctx, best.at)), fine, true, true, printed)
}

/**
 * Detection from the hole the user picked at `at` (image px): the colour axis is that of the hole
 * against the ring around it, and the hole size comes from its scale-space maximum, clamped to 0.7
 * to 1.4 of `expectedHoleDiameter`, then from the strongest peaks of the whole region (own
 * rule). The pick sets neither the size nor the strength reference of the peaks.
 */
export function detectFromExample(
  input: HoleDetectionInput,
  at: Point,
): (Found & { example: HoleExample }) | undefined {
  const ctx = prepare(input)
  if (!ctx || !(Number.isFinite(at.x) && Number.isFinite(at.y))) return undefined
  const got = solved(input, fromImage(ctx, at), ctx)
  if (!got) return undefined
  const { found, run } = got
  const rgb = (v: number) => Math.min(255, Math.max(0, Math.round(Math.exp(v) - 8)))
  return {
    ...found,
    example: {
      diameter: found.holeDiameter * input.pxPerM,
      backing: { r: rgb(run.mu[0]), g: rgb(run.mu[1]), b: rgb(run.mu[2]) },
      polarity: lumaOf(run.mu) < lumaOf(run.ring) ? 'dark' : 'light',
    },
  }
}

/** Sizes the hole, runs the pipeline and maps the shots to the image; undefined without a result. */
function solved(
  input: HoleDetectionInput,
  at: Point | undefined,
  shared?: Ctx,
  last = true,
  refine = true,
  /** The marks where the ring numerals stand are print: set from the runs of all seeds; absent: when there are three or more. */
  printed?: boolean,
): { found: Found; run: Run; holeDiameter: number } | undefined {
  const ctx = shared ?? prepare(input)
  if (!ctx) return undefined
  const { backing } = input
  const seed: Seed =
    at || !backing
      ? { at }
      : { mu: [Math.log(backing.r + 8), Math.log(backing.g + 8), Math.log(backing.b + 8)] }
  const sized = estimateHoleSize(ctx, seed, refine)
  if (!sized) return undefined
  const { run, holeDiameter } = sized
  const { marks, zone } = dropPrintMarks(ctx, run, printed)
  const found: Found = {
    // on a face without a drawn region the region is the face: a flier on it is a shot
    proposals: toProposals(ctx, marks, holeDiameter, !!ctx.face && !input.region),
    flagged: [],
    holeDiameter: (holeDiameter * ctx.blockSize) / input.pxPerM / (input.holeScale ?? 1),
  }
  if (last) ctx.progress(1)
  return { found, run: { ...run, shots: marks.map((m) => m.shot), zone }, holeDiameter }
}

/**
 * The hole diameter (work px) and the run at it: the prior, or the picked hole's size, clamped to
 * `SIZE_MIN` to `SIZE_MAX` of the prior; then once the size the strongest peaks of the run show.
 */
function estimateHoleSize(
  ctx: Ctx,
  seed: Seed,
  refine: boolean,
): { run: Run; holeDiameter: number } | undefined {
  const lo = SIZE_MIN * ctx.prior
  const hi = SIZE_MAX * ctx.prior
  let holeDiameter = ctx.prior
  if (seed.at) {
    const first = pickedSize(ctx, seed, holeDiameter)
    if (first === undefined) return undefined
    holeDiameter = clamp(first, lo, hi)
  }
  ctx.progress(0.3)
  let run = pipeline(ctx, holeDiameter, seed)
  if (!run) return undefined
  // the strongest peaks of the region refine the size once; with a face, when the peaks of the run
  // at the new size show the old size again, the estimate moves with D and the first run stays
  const refined = clamp(run.size, lo, hi)
  if (refine && Math.abs(refined / holeDiameter - 1) > 0.12) {
    const second = pipeline(ctx, refined, seed)
    const again = second && clamp(second.size, lo, hi)
    if (!(ctx.face && again && Math.abs(again - holeDiameter) < Math.abs(again - refined))) {
      holeDiameter = refined
      run = second ?? run
    }
  }
  return { run, holeDiameter }
}

/**
 * The shots of `run` with their image px, without the marks within half a hole of the working
 * image's edge and print: a dark mark on the black area and a light one on the paper, and the marks where the numerals stand when they are print (`printed`, or
 * when there are `NUMERALS_MIN` or more). `zone`: the shots where the numerals stand.
 */
function dropPrintMarks(ctx: Ctx, run: Run, printed: boolean | undefined) {
  const dark = lumaOf(run.mu) < lumaOf(run.ring)
  // a line that meets the photo's edge leaves a blob there
  const [lo, hiX, hiY] = [ctx.prior / 2, ctx.w - 1 - ctx.prior / 2, ctx.h - 1 - ctx.prior / 2]
  let marks = run.shots
    .filter((s) => s.x >= lo && s.y >= lo && s.x <= hiX && s.y <= hiY)
    .map((shot) => ({ shot, c: toImage(ctx, shot) }))
    .filter(({ shot, c }) => !(ctx.face?.black(c) === dark && shot.confidence < PRINT_CONFIDENCE))
  const roll = numeralRoll(ctx.face, marks)
  const numerals = marks.filter(({ c }) => ctx.face?.numeral?.(c, roll))
  const zone = numerals.map((m) => m.shot)
  if (printed || numerals.length >= NUMERALS_MIN) marks = marks.filter((m) => !numerals.includes(m))
  return { marks, zone }
}

/**
 * The turn of the face's axes on the photo (the face plane is found without it): the angle from the
 * nearest axis that most marks standing where numerals do share within `ROLL_SPREAD`, when
 * `NUMERALS_MIN` or more share it and two of them stand at one radius (within 3 %) on two axes, as
 * the numerals of a ring do; else 0.
 */
function numeralRoll(face: FaceLabel | undefined, marks: readonly { c: Point }[]): number {
  const { numeral, polar } = face ?? {}
  if (!numeral || !polar) return 0
  const q = Math.PI / 2
  // the axes repeat every quarter turn
  const offset = (a: number) => a - Math.round(a / q) * q
  const apart = (a: number, b: number) => Math.abs(offset(a - b))
  const cands = marks
    .map(({ c }) => ({ c, ...polar(c) }))
    .map((m) => ({ ...m, a: offset(m.angle) }))
    .filter((m) => numeral(m.c, m.a))
  const paired = (group: typeof cands) =>
    group.some((m) =>
      group.some(
        (o) =>
          Math.abs(o.radius / m.radius - 1) <= 0.03 &&
          Math.abs(((o.angle - m.angle + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) >= q / 2,
      ),
    )
  let [roll, most] = [0, NUMERALS_MIN - 1]
  for (const m of cands) {
    const group = cands.filter((o) => apart(o.a, m.a) <= ROLL_SPREAD)
    if (group.length > most && paired(group)) [roll, most] = [m.a, group.length]
  }
  return roll
}

/**
 * The marks inside the region as proposals in image px, most confident first, without strays
 * unless `fliers` (the region is a found face: a flier on it is a shot).
 */
function toProposals(
  ctx: Ctx,
  marks: { shot: HoleProposal; c: Point }[],
  holeDiameter: number,
  fliers: boolean,
): HoleProposal[] {
  const out: HoleProposal[] = []
  for (const { shot, c } of marks)
    if (insidePolygon(c, ctx.poly))
      out.push({ ...shot, ...c, diameter: shot.diameter * ctx.blockSize })
  out.sort((a, b) => b.confidence - a.confidence)
  return fliers ? out : dropStrays(out, holeDiameter * ctx.blockSize)
}

/** Image px of the working point `p`, and back. */
const toImage = (ctx: Ctx, p: Point): Point => ({
  x: ctx.x0 + p.x * ctx.blockSize + (ctx.blockSize - 1) / 2,
  y: ctx.y0 + p.y * ctx.blockSize + (ctx.blockSize - 1) / 2,
})
const fromImage = (ctx: Ctx, p: Point): Point => ({
  x: (p.x - ctx.x0 - (ctx.blockSize - 1) / 2) / ctx.blockSize,
  y: (p.y - ctx.y0 - (ctx.blockSize - 1) / 2) / ctx.blockSize,
})

/** The working image of the region with its margin, or undefined when the region is off the photo. */
function prepare(input: HoleDetectionInput, work = WORK_DIAMETER): Ctx | undefined {
  const { image, minContrast = 0.15 } = input
  const { holePx, poly } = validateInput(input)
  // the region plus a margin that holds the ring of a hole at its edge, averaged to ~16 px holes
  const { x0, y0, x1, y1 } = cropBox(poly, 3 * holePx, image)
  if (x1 <= x0 || y1 <= y0) return undefined
  const s = workBlockSize(holePx, x1 - x0, y1 - y0, work)
  const w = Math.ceil((x1 - x0) / s)
  const h = Math.ceil((y1 - y0) / s)
  const ctx: Ctx = {
    w,
    h,
    blockSize: s,
    x0,
    y0,
    logRgb: blockAverageLogRgb(image, { x0, y0, x1, y1 }, { s, w, h }),
    inside: insideMask(poly, { x0, y0, s, w, h }),
    poly,
    prior: holePx / s,
    keep: clamp((KEEP * minContrast) / 0.15, 0.05, 0.9),
    contrast: (MIN_SEP * minContrast) / 0.15,
    progress: (done) => input.onProgress?.(done),
  }
  if (input.face) {
    ctx.face = input.face
    ctx.blackMask = faceClassMask(ctx, input.face)
    if (!input.region) offSheet(ctx, image)
  }
  ctx.progress(0.05)
  return ctx
}

/** The hole diameter in image px and the region polygon; a RangeError or Error for invalid input. */
function validateInput(input: HoleDetectionInput): { holePx: number; poly: Point[] } {
  const {
    image,
    region,
    pxPerM,
    expectedHoleDiameter,
    minContrast = 0.15,
    holeScale = 1,
    backing,
  } = input
  if (
    !Number.isInteger(image.width) ||
    !Number.isInteger(image.height) ||
    image.data.length !== image.width * image.height * 4
  )
    throw new RangeError('The image must hold width x height RGBA pixels')
  if (![pxPerM, expectedHoleDiameter, holeScale, minContrast].every(Number.isFinite))
    throw new RangeError('Scale, bullet diameter, hole scale and contrast must be finite')
  if (backing && ![backing.r, backing.g, backing.b].every((c) => c >= 0 && c <= 255))
    throw new RangeError('A backing colour channel must be a number from 0 to 255')
  const holePx = expectedHoleDiameter * pxPerM * holeScale
  if (!(holePx >= 4)) throw new Error('The hole must be at least 4 px across')
  const r = region ?? input.face?.outline ?? paperOutline(image)
  const poly = 'width' in r ? rectangle(r) : [...r]
  if (poly.length < 3) throw new Error('A region needs at least 3 points')
  if (!poly.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    throw new RangeError('The region points must be finite')
  return { holePx, poly }
}

/** The bounding box of `poly` grown by `margin`, whole px, cut at the image edge. */
function cropBox(poly: Point[], margin: number, image: RgbaImage) {
  return {
    x0: clamp(Math.floor(Math.min(...poly.map((p) => p.x)) - margin), 0, image.width),
    y0: clamp(Math.floor(Math.min(...poly.map((p) => p.y)) - margin), 0, image.height),
    x1: clamp(Math.ceil(Math.max(...poly.map((p) => p.x)) + margin), 0, image.width),
    y1: clamp(Math.ceil(Math.max(...poly.map((p) => p.y)) + margin), 0, image.height),
  }
}

/** Planar log(mean RGB + 8) over `s` x `s` blocks of the crop, `w` x `h` blocks. */
function blockAverageLogRgb(
  image: RgbaImage,
  { x0, y0, x1, y1 }: { x0: number; y0: number; x1: number; y1: number },
  { s, w, h }: { s: number; w: number; h: number },
): Float32Array {
  const n = w * h
  const sum = new Float32Array(3 * n)
  const count = new Float32Array(n)
  for (let y = y0; y < y1; y++) {
    const row = Math.floor((y - y0) / s) * w
    for (let x = x0; x < x1; x++) {
      const i = (y * image.width + x) * 4
      const j = row + Math.floor((x - x0) / s)
      sum[j] = f32(sum, j) + u8(image.data, i)
      sum[n + j] = f32(sum, n + j) + u8(image.data, i + 1)
      sum[2 * n + j] = f32(sum, 2 * n + j) + u8(image.data, i + 2)
      count[j] = f32(count, j) + 1
    }
  }
  for (let c = 0; c < 3; c++)
    for (let j = 0; j < n; j++) sum[c * n + j] = Math.log(f32(sum, c * n + j) / f32(count, j) + 8)
  return sum
}

/**
 * Takes the blocks of the face's region off that lie neither on its black nor on the sheet (the
 * hull of `paperOutline`): the outer rings of a face on an insert card run past the card onto the
 * table. A hull that leaves 5 % of the black out is no sheet but the lit part of one in a shadow,
 * and cuts nothing.
 */
function offSheet(ctx: Ctx, image: RgbaImage) {
  const sheet = paperOutline(image)
  const { w, h, inside, blackMask } = ctx
  const onSheet = (j: number) =>
    insidePolygon(toImage(ctx, { x: j % w, y: Math.floor(j / w) }), sheet)
  let [black, out] = [0, 0]
  for (let j = 0; j < w * h; j++)
    if (blackMask?.[j]) [black, out] = [black + 1, out + (onSheet(j) ? 0 : 1)]
  if (out > 0.05 * black) return
  for (let j = 0; j < w * h; j++) if (inside[j] && !blackMask?.[j] && !onSheet(j)) inside[j] = 0
}

/** 1 for a block whose middle is inside `poly`, else 0. */
function insideMask(
  poly: Point[],
  { x0, y0, s, w, h }: { x0: number; y0: number; s: number; w: number; h: number },
): Uint8Array {
  const n = w * h
  const inside = new Uint8Array(n)
  for (let j = 0; j < n; j++)
    inside[j] = insidePolygon(
      { x: x0 + (j % w) * s + (s - 1) / 2, y: y0 + Math.floor(j / w) * s + (s - 1) / 2 },
      poly,
    )
      ? 1
      : 0
  return inside
}

/** 1 for a block on the black area of the printed face, else 0. */
function faceClassMask(ctx: Ctx, face: FaceLabel): Uint8Array {
  const { w, h } = ctx
  const mask = new Uint8Array(w * h)
  for (let j = 0; j < w * h; j++)
    mask[j] = face.black(toImage(ctx, { x: j % w, y: Math.floor(j / w) })) ? 1 : 0
  return mask
}

/** The hole diameter at the strongest wide-scale peak within one D of the pick, or undefined. */
function pickedSize(ctx: Ctx, seed: Seed, holeDiameter: number): number | undefined {
  // a disc that fits the smallest hole allowed, as the size is not known yet
  const axis = axisOf(ctx, holeDiameter, seed, DISC * SIZE_MIN * holeDiameter)
  if (!axis || !seed.at) return undefined
  // the scales of the pick only: a window of 2.5 D around it
  const reach = Math.ceil(2.5 * holeDiameter)
  const x0 = Math.max(0, Math.floor(seed.at.x) - reach)
  const y0 = Math.max(0, Math.floor(seed.at.y) - reach)
  const win = {
    x0,
    y0,
    w: Math.min(ctx.w, Math.floor(seed.at.x) + reach + 1) - x0,
    h: Math.min(ctx.h, Math.floor(seed.at.y) + reach + 1) - y0,
  }
  // a pick outside the working image has no window
  if (win.w < 3 || win.h < 3) return undefined
  const scales = space(project(ctx, axis, win), win.w, win.h, radiiOf(holeDiameter, WIDE))
  const at = seed.at
  const peaks = peaksOf(scales, new Uint8Array(win.w * win.h).fill(1), holeDiameter).filter(
    (p) => Math.hypot(p.x + x0 - at.x, p.y + y0 - at.y) <= holeDiameter,
  )
  const [first] = peaks
  return first ? D_OVER_SIGMA * first.sigma : undefined
}

/** Calls `f` with the index of every pixel of a `w` x `h` image within `r` of `p`. */
function around({ w, h }: { w: number; h: number }, p: Peak, r: number, f: (i: number) => void) {
  for (let y = Math.max(0, Math.floor(p.y - r)); y <= Math.min(h - 1, Math.ceil(p.y + r)); y++)
    for (let x = Math.max(0, Math.floor(p.x - r)); x <= Math.min(w - 1, Math.ceil(p.x + r)); x++)
      if ((x - p.x) ** 2 + (y - p.y) ** 2 <= r * r) f(y * w + x)
}

/**
 * One pass at hole diameter `holeDiameter` (work px): axis, projection, blob peaks, top-hat shape,
 * the peak tests, and the shots per connected part. The strength and contrast references are the
 * median of the 5 strongest peaks of the region, never the picked hole.
 */
function pipeline(ctx: Ctx, holeDiameter: number, seed: Seed): Run | undefined {
  const { w, h, inside } = ctx
  const axis = axisOf(ctx, holeDiameter, seed)
  if (!axis) return undefined
  const P = project(ctx, axis)
  const run: Run = { shots: [], size: holeDiameter, sizes: [], mu: axis.mu, ring: axis.ring }
  const hat = topHat(P, w, h, holeDiameter)
  const contrast = (p: Peak) => {
    let [sum, n] = [0, 0]
    around(ctx, p, 0.25 * holeDiameter, (i) => {
      sum += f32(hat, i)
      n++
    })
    return n ? sum / n : 0
  }
  // only peaks that stand out from their surroundings count: noise is no reference
  const standsOut = (p: Peak) => contrast(p) >= FLOOR
  const scales = space(P, w, h, radiiOf(holeDiameter, WIDE))
  // the first scales of the set, `SIGMAS`, find the peaks; all of them size the holes
  const peaks = peaksOf(scales, inside, holeDiameter, radiiOf(holeDiameter, SIGMAS).length).filter(
    standsOut,
  )
  if (!peaks.length) return run
  ctx.progress(0.6)
  const top = peaks.slice(0, 5)
  const r5 = median1(top.map((p) => p.response))
  const threshold = HAT * median1(top.map(contrast))
  const mask = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) mask[i] = f32(hat, i) > threshold && inside[i] ? 1 : 0
  const parts = components(mask, w, h)
  const kept = testPeaks(peaks, mask, parts, { w, h, keep: ctx.keep, r5, holeDiameter })
  run.sizes = estimateSize(kept, scales, w)
  run.size = run.sizes.length ? median1(run.sizes) : holeDiameter
  run.shots = shotsFromParts(kept, parts, r5, holeDiameter)
  return run
}

/** Top-hat of `P` (blurred by radius 1) against its opening by a square of 2 D, on a copy shrunk by `OPEN_SHRINK`. */
function topHat(P: Float32Array, w: number, h: number, holeDiameter: number): Float32Array {
  const smooth = new Float32Array(w * h)
  boxBlur(P, w, h, 1, new Float32Array(w * h), smooth)
  // the background changes slowly, so the opening runs on a copy shrunk by OPEN_SHRINK
  const f = OPEN_SHRINK
  const [w2, h2] = [Math.ceil(w / f), Math.ceil(h / f)]
  const small = new Float32Array(w2 * h2)
  for (let y = 0; y < h2; y++)
    for (let x = 0; x < w2; x++) {
      let [sum, n] = [0, 0]
      for (let v = y * f; v < Math.min(h, (y + 1) * f); v++)
        for (let u = x * f; u < Math.min(w, (x + 1) * f); u++) {
          sum += f32(smooth, v * w + u)
          n++
        }
      small[y * w2 + x] = sum / n
    }
  const opened = open(small, w2, h2, Math.max(1, Math.round(holeDiameter / f)))
  return smooth.map(
    (v, i) => v - f32(opened, Math.floor(Math.floor(i / w) / f) * w2 + Math.floor((i % w) / f)),
  )
}

/**
 * The peak tests, strongest first until one is under `keep` of `r5`: strength, inscribed radius,
 * fill share. The kept peaks by the index of their part of `mask`.
 */
function testPeaks(
  peaks: Peak[],
  mask: Uint8Array,
  parts: number[][],
  o: { w: number; h: number; keep: number; r5: number; holeDiameter: number },
): Map<number, Peak[]> {
  const { w, h, holeDiameter } = o
  const depth = distanceSquared(mask, w, h, 0)
  const label = new Int32Array(w * h).fill(-1)
  parts.forEach((c, k) => {
    for (const i of c) label[i] = k
  })
  const kept = new Map<number, Peak[]>()
  for (const p of peaks) {
    if (p.response < o.keep * o.r5) break
    let [deep, at] = [0, -1]
    around(o, p, 0.3 * holeDiameter, (i) => {
      if (mask[i] && f64(depth, i) > deep) [deep, at] = [f64(depth, i), i]
    })
    if (at < 0 || Math.sqrt(deep) < INSCRIBED * holeDiameter) continue
    let [filled, total] = [0, 0]
    around(o, p, 0.5 * holeDiameter, (i) => {
      total++
      filled += u8(mask, i)
    })
    if (filled < FILL * total) continue
    const part = i32(label, at)
    kept.set(part, [...(kept.get(part) ?? []), p])
  }
  return kept
}

/** The hole diameters (work px) at the scale-space maxima of the 5 strongest kept peaks over the wide set of scales. */
function estimateSize(kept: Map<number, Peak[]>, scales: Space, w: number): number[] {
  return [...kept.values()]
    .flat()
    .sort((a, b) => b.response - a.response)
    .slice(0, 5)
    .map((p) => D_OVER_SIGMA * sigmaAt(scales, Math.round(p.y) * w + Math.round(p.x)))
}

/** One shot per kept peak; the peaks of one part form a cluster, a part far larger than its holes is print. */
function shotsFromParts(
  kept: Map<number, Peak[]>,
  parts: number[][],
  r5: number,
  holeDiameter: number,
): HoleProposal[] {
  const shots: HoleProposal[] = []
  let clusterId = 0
  for (const [k, list] of kept) {
    const diameter = Math.sqrt((4 * nth(parts, k).length) / (Math.PI * list.length))
    // print: a part with far more area than its peaks have holes
    if (diameter > MAX_PART * holeDiameter) continue
    for (const p of list)
      shots.push({
        x: p.x,
        y: p.y,
        confidence: clamp(p.response / r5, 0, 1),
        clusterSize: list.length,
        clusterId,
        diameter,
      })
    clusterId++
  }
  return shots
}

/**
 * Own rule: `list` without the proposals whose nearest other proposal is farther than 4 times the
 * median of those nearest distances plus 2 hole diameters (`holePx`): print, stains and background
 * apart from the shots, not a flier near the group or a second group.
 */
function dropStrays(list: HoleProposal[], holePx: number): HoleProposal[] {
  if (list.length < 4) return list
  const nearest = list.map((p) =>
    Math.min(...list.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.y - p.y))),
  )
  const m = nth(
    [...nearest].sort((a, b) => a - b),
    nearest.length >> 1,
  )
  return list.filter((_, i) => nth(nearest, i) <= 4 * m + 2 * holePx)
}
