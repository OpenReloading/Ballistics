/**
 * Web Worker of the target editor: decodes the photo the editor posts (a Blob from the browser
 * store; nothing leaves the browser), downscales it so a hole is about 32 px across (`createImageBitmap`
 * with a resize), cuts the region with its margin (the whole turned photo without a region) and runs
 * `findHoles`, `autoDetect` or `detectFromExample` on it, or reads the colour inside one hole at full
 * resolution (`apps/docs/docs/models/hole-detection.md`), or looks for the target face in the
 * whole photo. Points are on the photo as turned on screen.
 */

import { fromSi } from '@open-reloading/schema'
import { errorText } from './error-text.ts'
import {
  autoDetect,
  detectFromExample,
  type FlaggedRegion,
  findHoles,
  type HoleExample,
  type HoleProposal,
  WORK_DIAMETER,
} from './hole-detection.ts'
import type { Photo, WorkerReply, WorkerRequest } from './hole-detection-protocol.ts'
import { nth } from './nth.ts'
import { layoutOf, photoQuality } from './photo-quality.ts'
import { clamp } from './raster-ops.ts'
import { faceLabel, findFace, onPhoto } from './target-face.ts'
import { mul3, type Point, turnedBox } from './target-geometry.ts'

/** The face search looks at the photo resized to this many px on its longer side. */
const FACE_LONG = 2000

const post = (m: WorkerReply) => self.postMessage(m)

/**
 * The turned photo's pixels from (x0, y0) to (x1, y1) (photo px) at `k` times its size, orientation
 * applied as the browser shows it; outside the photo white. `k` below 1 resizes while decoding.
 */
async function pixels(p: Photo, x0: number, y0: number, x1: number, y1: number, k = 1) {
  const width = Math.round(p.width * k)
  let bitmap = await createImageBitmap(p.photo, {
    imageOrientation: 'from-image',
    ...(k < 1 && { resizeWidth: width, resizeQuality: 'high' }),
  })
  try {
    // a browser that resizes before it applies the orientation gives another height: decode whole
    if (k < 1 && (bitmap.width !== width || Math.abs(bitmap.height - p.height * k) > 1)) {
      bitmap.close()
      bitmap = await createImageBitmap(p.photo, { imageOrientation: 'from-image' })
    }
    const whole = bitmap.width === p.width && bitmap.height === p.height
    if (!whole && bitmap.width !== width)
      throw new Error(
        'The photo decodes at another size than it is shown; detection is off for it.',
      )
    const [w, h] = [Math.ceil((x1 - x0) * k), Math.ceil((y1 - y0) * k)]
    const canvas = new OffscreenCanvas(w, h)
    const g = canvas.getContext('2d', { willReadFrequently: true })
    if (!g) throw new Error('No canvas to read the photo.')
    if (p.photoRotation) {
      g.fillStyle = '#fff'
      g.fillRect(0, 0, w, h)
    }
    g.imageSmoothingQuality = 'high'
    // as the editor draws it: turned about the photo's middle, counter-clockwise on screen
    g.translate((p.width / 2 - x0) * k, (p.height / 2 - y0) * k)
    g.rotate(-p.photoRotation)
    g.drawImage(bitmap, (-p.width * k) / 2, (-p.height * k) / 2, p.width * k, p.height * k)
    return g.getImageData(0, 0, w, h)
  } finally {
    bitmap.close()
  }
}

/** The box of `pts` grown by `margin`, whole px, cut at the edge of the turned photo. */
function box(pts: Point[], margin: number, p: Photo) {
  const xs = pts.map((q) => q.x)
  const ys = pts.map((q) => q.y)
  const t = turnedBox(p.width, p.height, p.photoRotation)
  return [
    clamp(Math.floor(Math.min(...xs) - margin), Math.floor(t.x), Math.ceil(t.x + t.w)),
    clamp(Math.floor(Math.min(...ys) - margin), Math.floor(t.y), Math.ceil(t.y + t.h)),
    clamp(Math.ceil(Math.max(...xs) + margin), Math.floor(t.x), Math.ceil(t.x + t.w)),
    clamp(Math.ceil(Math.max(...ys) + margin), Math.floor(t.y), Math.ceil(t.y + t.h)),
  ] as const
}

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const r = e.data
  try {
    if (r.kind === 'colour') return post(await handleColour(r))
    post({ kind: 'progress', done: 0.02 })
    if (r.kind === 'face') return post(await handleFace(r))
    post(await handleDetect(r))
  } catch (err) {
    post({ kind: 'error', message: errorText(err) })
  }
}

/** The median colour per channel inside the circle of `radius` about `at`, at full resolution. */
async function handleColour(r: Extract<WorkerRequest, { kind: 'colour' }>): Promise<WorkerReply> {
  const [x0, y0, x1, y1] = box([r.at], r.radius, r)
  if (x1 <= x0 || y1 <= y0) throw new Error('The point is outside the photo.')
  const img = await pixels(r, x0, y0, x1, y1)
  // the median per channel inside the circle: a torn rim or a fibre does not shift it
  const [reds, greens, blues]: [number[], number[], number[]] = [[], [], []]
  const ch = [reds, greens, blues]
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      if (Math.hypot(x0 + x - r.at.x, y0 + y - r.at.y) > r.radius) continue
      const i = (y * img.width + x) * 4
      for (const [c, v] of img.data.subarray(i, i + 3).entries()) ch[c]?.push(v)
    }
  if (!reds.length) throw new Error('The point is outside the photo.')
  const median = (v: number[]) =>
    nth(
      v.sort((a, b) => a - b),
      v.length >> 1,
    )
  return { kind: 'colour', rgb: { r: median(reds), g: median(greens), b: median(blues) } }
}

/** The face search and the quality check over the whole turned photo, resized to `FACE_LONG` px on its longer side. */
async function handleFace(r: Extract<WorkerRequest, { kind: 'face' }>): Promise<WorkerReply> {
  const t = turnedBox(r.width, r.height, r.photoRotation)
  const [fx0, fy0] = [Math.floor(t.x), Math.floor(t.y)]
  const [fx1, fy1] = [Math.ceil(t.x + t.w), Math.ceil(t.y + t.h)]
  const fk = Math.min(1, FACE_LONG / Math.max(fx1 - fx0, fy1 - fy0))
  const shot = await pixels(r, fx0, fy0, fx1, fy1, fk)
  post({ kind: 'progress', done: 0.3 })
  const found = findFace(
    { width: shot.width, height: shot.height, data: shot.data },
    r.faces,
    r.pxPerMm && r.pxPerMm * fk,
    r.holeDiameter && fromSi('length', r.holeDiameter),
  )
  // the hole on the resized photo, from the scale of the best fit
  const [fit] = found.fits
  const holePx = fit && r.holeDiameter ? fit.pxPerMm * fromSi('length', r.holeDiameter) : undefined
  // the selected target's layout, else the one of a face found for sure; a weaker match is no hint
  const layout =
    r.layout ?? (found.sure && found.alike.length < 2 && fit ? layoutOf(fit.face) : undefined)
  const quality = photoQuality({ image: shot, scale: fk, black: found.black, holePx, layout })
  return { kind: 'face', search: onPhoto(found, fk, fx0, fy0), quality }
}

/** A detection run on the region (or the face, or the whole turned photo) at the working size. */
async function handleDetect(
  r: Extract<WorkerRequest, { kind: 'detect' | 'example' }>,
): Promise<WorkerReply> {
  const t = turnedBox(r.width, r.height, r.photoRotation)
  const all = [
    { x: t.x, y: t.y },
    { x: t.x + t.w, y: t.y + t.h },
  ]
  // a hole about twice WORK_DIAMETER px across: the photo is resized while it loads, and the
  // module averages it down to the working size (a coarse and a full one for auto detection)
  const k = Math.min(1, (2 * WORK_DIAMETER) / (r.holeDiameter * r.pxPerM))
  // the face's outline on the photo, grown by half a hole
  const holeMm = fromSi('length', r.holeDiameter)
  const onTurned = r.face && faceLabel(r.face, holeMm)
  // the margin the detection's ring around a hole at the region's edge needs
  const base = r.region ?? onTurned?.outline
  const pts = base ? [...base, ...(r.kind === 'example' ? [r.at] : [])] : all
  const [x0, y0, x1, y1] = box(pts, 4 * r.holeDiameter * r.pxPerM, r)
  if (x1 <= x0 || y1 <= y0) return { kind: 'proposals', proposals: [], flagged: [] }
  const img = await pixels(r, x0, y0, x1, y1, k)
  post({ kind: 'progress', done: 0.2 })
  const toWork = (p: Point): Point => ({ x: (p.x - x0) * k, y: (p.y - y0) * k })
  // the face on the working px: the work crop starts at (x0, y0) and is k times the photo
  const face =
    r.face &&
    faceLabel(
      {
        ...r.face,
        toFace: mul3(r.face.toFace, [1 / k, 0, x0, 0, 1 / k, y0, 0, 0, 1]),
      },
      holeMm,
    )
  const input = {
    image: { width: img.width, height: img.height, data: img.data },
    ...(r.region && { region: r.region.map(toWork) }),
    ...(face && { face }),
    pxPerM: r.pxPerM * k,
    expectedHoleDiameter: r.holeDiameter,
    minContrast: r.minContrast,
    onProgress: (done: number) => post({ kind: 'progress', done: 0.2 + 0.8 * done }),
  }
  const found = runDetection(r, input, toWork)
  return toPhotoPx(found, k, x0, y0)
}

/** The example, auto or plain detection on the working image. */
function runDetection(
  r: Extract<WorkerRequest, { kind: 'detect' | 'example' }>,
  input: Parameters<typeof findHoles>[0],
  toWork: (p: Point) => Point,
): Found {
  if (r.kind === 'example')
    return detectFromExample(input, toWork(r.at)) ?? { proposals: [], flagged: [] }
  if (r.auto) return autoDetect(input) ?? { proposals: [], flagged: [] }
  return findHoles({
    ...input,
    ...(r.backing && { backing: r.backing }),
    ...(r.polarity && { polarity: r.polarity }),
  })
}

type Found = {
  proposals: HoleProposal[]
  flagged: FlaggedRegion[]
  holeDiameter?: number
  example?: HoleExample
}

/** The reply with the run's working px mapped back to photo px: `k` times the photo, from (x0, y0). */
function toPhotoPx(found: Found, k: number, x0: number, y0: number): WorkerReply {
  return {
    kind: 'proposals',
    proposals: found.proposals.map((p) => ({
      ...p,
      x: p.x / k + x0,
      y: p.y / k + y0,
      diameter: p.diameter / k,
    })),
    flagged: found.flagged.map((f) => ({
      ...f,
      x: f.x / k + x0,
      y: f.y / k + y0,
      width: f.width / k,
      height: f.height / k,
    })),
    ...(found.holeDiameter !== undefined && { holeDiameter: found.holeDiameter }),
    ...(found.example && { example: { ...found.example, diameter: found.example.diameter / k } }),
  }
}
