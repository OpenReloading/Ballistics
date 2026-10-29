/**
 * The face search with the hole size as a scale, apart from `target-face.ts` because only the
 * Web Worker runs it: the blob detector stays out of the pages' bundles.
 */
import type { TargetFace } from '@open-reloading/schema'
import { peaksOf, radiiOf, space } from './blob-detector.ts'
import { conicOf, type Ellipse } from './ellipse.ts'
import { grayGrid, gridToImage } from './face-image.ts'
import type { RgbaImage } from './image.ts'
import { nth } from './nth.ts'
import { type FaceSearch, SCALE_TOLERANCE, searchFaces } from './target-face.ts'

/** A disc of radius r peaks the scale-normalised Hessian at sigma = r / sqrt 2: D = 2 sqrt 2 sigma. */
const D_OVER_SIGMA = 2 * Math.SQRT2
/** The holes are measured on a grid where the largest expected hole is about this many px across. */
const HOLE_PX = 30

/**
 * Finds the target face in a photo. `image` may be any size: the search runs on a grid of about
 * 700 px and a crop of about 1400 px. `fits` is empty when no face is proposed (no black area, or
 * fewer than two rings match): `ellipses` and `ranked` are then what the editor shows. More than
 * one fit means ratio twins: the user's event or distance tells them apart. A known `scale` (image px per mm) drops the faces of another size first.
 * Without one, the hole diameter (`hole`, mm) sets it when the faces `alike` differ in size: the
 * size of the holes on the black area in px over `hole`.
 */
export function findFace(
  image: RgbaImage,
  faces: readonly TargetFace[],
  scale?: number | undefined,
  hole?: number | undefined,
): FaceSearch {
  const found = searchFaces(image, faces, scale)
  if (scale || !hole || !found.black || found.alike.length < 2) return found
  const sizes = found.alike.map((f) => f.pxPerMm * hole)
  const [lo, hi] = [Math.min(...sizes), Math.max(...sizes)]
  // faces of one size: a scale does not tell them apart
  if (hi / lo < 1 + 2 * SCALE_TOLERANCE) return found
  const px = holeSize(image, found.black, lo, hi)
  const scaled = px ? searchFaces(image, faces, px / hole) : undefined
  return scaled?.fits.length ? scaled : found
}

/**
 * The diameter (px) of the strongest light blobs on the black area between `lo` and `hi` px: the
 * holes, which show the backing. Undefined when there is none.
 */
function holeSize(image: RgbaImage, black: Ellipse, lo: number, hi: number) {
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
  if (inner.semiMinor <= 0) return
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
  if (!top) return
  const d = peaks
    .filter((p) => p.response >= 0.5 * top.response)
    .slice(0, 5)
    .map((p) => D_OVER_SIGMA * p.sigma * k)
    .sort((x, y) => x - y)
  return nth(d, d.length >> 1)
}
