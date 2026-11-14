/** Apart from `target-face.ts` because only the worker runs it, which keeps the blob detector out of the pages' bundles. */
import { conicOf, type Ellipse } from '@rangefoundry/shot-groups'
import { nth } from '@rangefoundry/statistics'
import { peaksOf, radiiOf, space } from './blob-detector.ts'
import { grayGrid, gridToImage } from './face-image.ts'
import type { RgbaImage } from './image.ts'
import { type FaceSearch, type PrintedFace, SCALE_TOLERANCE, searchFaces } from './target-face.ts'

/** A disc of radius r peaks the scale-normalized Hessian at sigma = r / sqrt 2: D = 2 sqrt 2 sigma. */
const D_OVER_SIGMA = 2 * Math.SQRT2
/** The holes are measured on a grid where the largest expected hole is about this many px across. */
const HOLE_PX = 30

/** `image` of any size runs on a grid of about 700 px; several fits are ratio twins the event or distance tells apart; a known `scale` (image px per mm) or `hole` (mm) drops other sizes. */
export function findFace<F extends PrintedFace = PrintedFace>(
  image: RgbaImage,
  faces: readonly F[],
  scale?: number,
  hole?: number,
): FaceSearch<F> {
  const found = searchFaces(image, faces, scale)
  if (scale || !hole || !found.black || found.alike.length < 2) return found
  const sizes = found.alike.map((f) => f.pxPerMm * hole)
  const [lo, hi] = [Math.min(...sizes), Math.max(...sizes)]
  // faces of one size: a scale does not tell them apart
  if (hi / lo < 1 + 2 * SCALE_TOLERANCE) return found
  const px = holeSize(image, found.black, lo, hi)
  // A fit's px per mm is a mean over the tilt; `scale` runs along the black area's long axis.
  const fit = nth(found.alike, 0)
  const toMajor = found.black.semiMajor / (fit.face.blackDiameter.value / 2) / fit.pxPerMm
  const scaled = px ? searchFaces(image, faces, (px * toMajor) / hole) : undefined
  return scaled?.fits.length ? scaled : found
}

/** Diameter in px of the strongest light blobs between `lo` and `hi` px, the holes, which show the backing; undefined when there is none. */
function holeSize(image: RgbaImage, black: Ellipse, lo: number, hi: number): number | undefined {
  const r = black.semiMajor
  const grid = grayGrid(image, Math.max(1, Math.floor(hi / HOLE_PX)), {
    x0: black.centreX - r,
    y0: black.centreY - r,
    x1: black.centreX + r,
    y1: black.centreY + r,
  })
  const { width: w, height: h, blockSize: k } = grid
  // inside the black edge by a large hole, so the edge itself gives no blob
  const inner = { ...black, semiMajor: black.semiMajor - hi, semiMinor: black.semiMinor - hi }
  if (inner.semiMinor <= 0) return undefined
  const [A, B, C, D, E, F] = conicOf(inner)
  const inside = new Uint8Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = gridToImage(grid, { x, y })
      if (A * p.x * p.x + B * p.x * p.y + C * p.y * p.y + D * p.x + E * p.y + F < 0)
        inside[y * w + x] = 1
    }
  // a hole in paper shows smaller than its bullet: diameters from 0.6 lo to 1.2 hi, grid px
  const [d0, d1] = [(0.6 * lo) / k, (1.2 * hi) / k]
  const sigmas = Array.from({ length: 9 }, (_, i) => (d0 * (d1 / d0) ** (i / 8)) / D_OVER_SIGMA)
  const peaks = peaksOf(space(grid.grey, w, h, radiiOf(1, sigmas)), inside, d0)
  const top = peaks[0]
  if (!top) return undefined
  const d = peaks
    .filter((p) => p.response >= 0.5 * top.response)
    .slice(0, 5)
    .map((p) => D_OVER_SIGMA * p.sigma * k)
    .toSorted((x, y) => x - y)
  return nth(d, d.length >> 1)
}
