/** A learned hole detector behind the inference port; the model runs through an injected function, so the package keeps no I/O. */
import type { Point } from '@rangefoundry/shot-groups'
import { nth } from '@rangefoundry/statistics'
import { MAYBE_BELOW } from './confidence-tier.ts'
import { checkScales, cropBox, type HoleProposal, MAX_WORK_PIXELS } from './hole-detection.ts'
import type { RgbaImage } from './image.ts'
import type { InferencePort, ProposalRequest, Proposals } from './inference-port.ts'
import type { ModelManifest } from './model-manifest.ts'
import { clamp, insidePolygon, rectangle } from './raster-ops.ts'

// Unchecked pixel-buffer reads inside loops whose bounds keep the index in range; module-local so the calls inline.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the loop bounds keep the index in range
const f32 = (a: Float32Array, i: number) => a[i] as number
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the loop bounds keep the index in range
const u8 = (a: Uint8ClampedArray, i: number) => a[i] as number

/** A float tensor, dimensions in NCHW order, as a model runtime takes and returns it. */
export type ModelTensor = { data: Float32Array; dims: readonly number[] }

/** One model run: the working image (1 x 3 x height x width) in, the heatmap (1 x channels x height / stride x width / stride) out. */
export type RunModel = (input: ModelTensor) => Promise<ModelTensor>

/** A manifest whose output contract the decoder does not read, or a model output that breaks its manifest. */
export class ModelContractError extends Error {
  override name = 'ModelContractError'
}

// the classical detector's margin around the region, in expected hole diameters
const MARGIN = 3

/** The inference port of a model: `manifest` gives the working scale, padding, threshold and tiers, `run` the heatmap; throws a `ModelContractError` unless the output has one channel and a stride that divides the size multiple. */
export function learnedDetector(manifest: ModelManifest, run: RunModel): InferencePort {
  const { input, output } = manifest
  if (output.channels !== 1 || input.sizeMultiple % output.stride !== 0)
    throw new ModelContractError(
      `The decoder reads 1 heatmap channel at a stride that divides the size multiple ${input.sizeMultiple}, not ${output.channels} at stride ${output.stride}`,
    )
  return { propose: async (request) => propose(request, manifest, run) }
}

type Box = { x0: number; y0: number; x1: number; y1: number }
type Size = { w: number; h: number; pw: number; ph: number }

/** A plain run on the region (else the face outline, else the whole image); `at` and `auto` change nothing, as the scale comes from the expected hole diameter. */
async function propose(
  r: ProposalRequest,
  { input, output }: ModelManifest,
  run: RunModel,
): Promise<Proposals> {
  const { holePx, poly, box } = areaOf(r)
  const [cw, ch] = [box.x1 - box.x0, box.y1 - box.y0]
  if (cw < 1 || ch < 1) return { proposals: [], flagged: [] }
  const size = sizeOf(cw, ch, input.holePx / holePx, input.sizeMultiple)
  const data = tensor(resample(r.image, box, size), size, input)
  const heat = await run({ data, dims: [1, 3, size.ph, size.pw] })
  const [gw, gh] = [size.pw / output.stride, size.ph / output.stride]
  const want = [1, 1, gh, gw]
  if (heat.dims.join() !== want.join() || heat.data.length !== gw * gh)
    throw new ModelContractError(
      `The model returned ${heat.dims.join(' x ')} for ${want.join(' x ')}`,
    )
  const t = output.stride
  const found = peaks(heat.data, gw, gh, output.threshold)
    // a peak whose cell center lies in the padding has no photo px
    .filter((p) => (p.x + 0.5) * t <= size.w && (p.y + 0.5) * t <= size.h)
    .map((p) => ({
      x: box.x0 + ((p.x + 0.5) * t * cw) / size.w - 0.5,
      y: box.y0 + ((p.y + 0.5) * t * ch) / size.h - 0.5,
      confidence: confidence(p.value, output.sure),
    }))
    .filter((p) => !poly || insidePolygon(p, poly))
  return { proposals: clustered(found, holePx), flagged: [] }
}

/** The expected hole diameter in photo px, the region's polygon and the box the run works on, with the classical detector's margin. */
function areaOf(r: ProposalRequest): { holePx: number; poly: Point[] | undefined; box: Box } {
  checkScales(r)
  const holePx = r.expectedHoleDiameter * r.pxPerM * (r.holeScale ?? 1)
  if (!(holePx > 0)) throw new RangeError('The expected hole diameter must be positive')
  const area = r.region ?? r.face?.outline
  if (!area)
    return { holePx, poly: undefined, box: { x0: 0, y0: 0, x1: r.image.width, y1: r.image.height } }
  const poly = 'width' in area ? rectangle(area) : [...area]
  if (poly.length < 3) throw new Error('A region needs at least 3 points')
  if (!poly.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    throw new RangeError('The region points must be finite')
  return { holePx, poly, box: cropBox(poly, MARGIN * holePx, r.image) }
}

/** The working size at `scale` and its padding to `multiple`; a RangeError past the working px cap. */
function sizeOf(cw: number, ch: number, scale: number, multiple: number): Size {
  const [w, h] = [Math.max(1, Math.round(cw * scale)), Math.max(1, Math.round(ch * scale))]
  const [pw, ph] = [Math.ceil(w / multiple) * multiple, Math.ceil(h / multiple) * multiple]
  if (pw * ph > MAX_WORK_PIXELS)
    throw new RangeError('The region is too large for holes this small; mark a smaller region')
  return { w, h, pw, ph }
}

/** Per working px of one axis, the first source px it covers and the shares of it each covered px gives. */
function coverage(from: number, to: number): { first: number; shares: number[] }[] {
  const s = to / from
  return Array.from({ length: to }, (_, u) => {
    const [a, b] = [u / s, Math.min(from, (u + 1) / s)]
    const first = Math.floor(a)
    const shares: number[] = []
    for (let k = first; k < b; k++) shares.push((Math.min(b, k + 1) - Math.max(a, k)) * s)
    return { first, shares }
  })
}

/** Planar RGB (0 to 255) of the box resampled to `w` x `h`, each working px the mean of the photo area it covers. */
function resample(image: RgbaImage, { x0, y0, x1, y1 }: Box, { w, h }: Size): Float32Array {
  const [cw, ch] = [x1 - x0, y1 - y0]
  const cols = coverage(cw, w)
  const rows = coverage(ch, h)
  const wide = new Float32Array(3 * w * ch)
  for (let y = 0; y < ch; y++)
    for (let u = 0; u < w; u++) {
      const { first, shares } = nth(cols, u)
      const start = ((y0 + y) * image.width + x0 + first) * 4
      for (let c = 0; c < 3; c++) wide[(c * ch + y) * w + u] = mix(image.data, start + c, shares)
    }
  const out = new Float32Array(3 * w * h)
  for (let c = 0; c < 3; c++)
    for (let v = 0; v < h; v++) {
      const { first, shares } = nth(rows, v)
      for (const [k, share] of shares.entries())
        addRow(
          out.subarray((c * h + v) * w, (c * h + v + 1) * w),
          wide.subarray((c * ch + first + k) * w),
          share,
        )
    }
  return out
}

/** Adds `share` times the first values of `from` to each value of `to`. */
function addRow(to: Float32Array, from: Float32Array, share: number): void {
  for (let u = 0; u < to.length; u++) to[u] = f32(to, u) + share * f32(from, u)
}

/** The covered px of one channel from `at` (RGBA px apart), weighted by their shares. */
function mix(data: Uint8ClampedArray, at: number, shares: readonly number[]): number {
  let sum = 0
  for (const [k, share] of shares.entries()) sum += share * u8(data, at + 4 * k)
  return sum
}

/** The model input: channels in the manifest's order, values scaled to its range, the right and bottom padding repeating the edge px. */
function tensor(
  work: Float32Array,
  { w, h, pw, ph }: Size,
  { channels, range: [lo, hi] }: ModelManifest['input'],
): Float32Array {
  const order = channels === 'rgb' ? [0, 1, 2] : [2, 1, 0]
  const out = new Float32Array(3 * pw * ph)
  for (const [c, from] of order.entries())
    for (let v = 0; v < ph; v++)
      for (let u = 0; u < pw; u++) {
        const j = (from * h + Math.min(v, h - 1)) * w + Math.min(u, w - 1)
        out[(c * ph + v) * pw + u] = lo + ((hi - lo) * f32(work, j)) / 255
      }
  return out
}

/** Cells at or above `threshold` that no 8-neighbor exceeds. */
function peaks(heat: Float32Array, gw: number, gh: number, threshold: number) {
  // the heatmap holds 32-bit floats, so a peak written as the threshold compares equal to it
  const least = Math.fround(threshold)
  const out: (Point & { value: number })[] = []
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const value = f32(heat, y * gw + x)
      if (value >= least && isPeak(heat, gw, gh, y * gw + x)) out.push({ x, y, value })
    }
  return out
}

/** No 8-neighbor of cell `i` exceeds it, and of equal ones it comes first in row order. */
function isPeak(heat: Float32Array, gw: number, gh: number, i: number): boolean {
  const [x, y, value] = [i % gw, Math.floor(i / gw), f32(heat, i)]
  for (let ny = Math.max(0, y - 1); ny <= Math.min(gh - 1, y + 1); ny++)
    for (let nx = Math.max(0, x - 1); nx <= Math.min(gw - 1, x + 1); nx++) {
      const n = f32(heat, ny * gw + nx)
      if (n > value || (n === value && ny * gw + nx < i)) return false
    }
  return true
}

/** The peak on the confidence scale: `sure` maps to the sure tier's lower edge, 0 and 1 stay, linear between them. */
function confidence(peak: number, sure: number): number {
  const s = Math.fround(sure)
  if (peak < s) return (MAYBE_BELOW * peak) / s
  if (s >= 1) return 1
  return clamp(MAYBE_BELOW + ((1 - MAYBE_BELOW) * (peak - s)) / (1 - s), 0, 1)
}

const NEIGHBOR_BUCKETS = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => [dx, dy] as const))

/** Index pairs `i < j` of points closer than `holePx`; a pair lies in the same or an adjacent bucket of side `holePx`, so no other pair is compared. */
function* closePairs(points: Point[], holePx: number): Generator<[number, number]> {
  const buckets = new Map<string, number[]>()
  const cell = (p: Point) => [Math.floor(p.x / holePx), Math.floor(p.y / holePx)] as const
  for (const [i, p] of points.entries()) {
    const key = cell(p).join()
    const bucket = buckets.get(key)
    if (bucket) bucket.push(i)
    else buckets.set(key, [i])
  }
  for (const [i, a] of points.entries()) {
    const [cx, cy] = cell(a)
    const nearby = NEIGHBOR_BUCKETS.flatMap(
      ([dx, dy]) => buckets.get(`${cx + dx},${cy + dy}`) ?? [],
    )
    for (const j of nearby) {
      const b = nth(points, j)
      if (j > i && Math.hypot(a.x - b.x, a.y - b.y) < holePx) yield [i, j]
    }
  }
}

/** Proposals chained by centers closer than one hole diameter share a cluster. */
function clustered(found: (Point & { confidence: number })[], holePx: number): HoleProposal[] {
  const root = found.map((_, i) => i)
  const find = (i: number): number => {
    let k = i
    while (nth(root, k) !== k) k = nth(root, k)
    return k
  }
  for (const [i, j] of closePairs(found, holePx)) root[find(j)] = find(i)
  const ids = new Map<number, number>()
  const sizes = new Map<number, number>()
  for (const i of root.keys()) {
    const k = find(i)
    if (!ids.has(k)) ids.set(k, ids.size)
    sizes.set(k, (sizes.get(k) ?? 0) + 1)
  }
  return found.map((p, i) => ({
    ...p,
    clusterSize: sizes.get(find(i)) ?? 1,
    clusterId: ids.get(find(i)) ?? 0,
    diameter: holePx,
  }))
}
