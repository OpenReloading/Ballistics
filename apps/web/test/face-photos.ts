import type { TargetFace } from '@open-reloading/schema'
import sharp from 'sharp'
import { expect } from 'vitest'
import { findFace } from '../src/lib/face-search.ts'
import { autoDetect } from '../src/lib/hole-detection.ts'
import type { RgbaImage } from '../src/lib/image.ts'
import { type FaceFit, faceLabel } from '../src/lib/target-face.ts'
import { applyMatrix } from '../src/lib/target-geometry.ts'
import { defined } from './defined.ts'
import { type Camera, faceById, faces, project, render, type Scene } from './face-render.ts'

// The photos people take of a sheet (`photoScene`): the face search and the hole detection on the
// face it finds, as the editor runs them. One test file per face, so they run in parallel.

/** The photos people take of a sheet: the whole sheet, the insert card, zoomed in, off centre, cut at the edges, skewed, poor. */
export const photoKinds = ['whole', 'insert', 'zoom', 'corner', 'cut', 'skewed', 'poor'] as const
export type PhotoKind = (typeof photoKinds)[number]

/** Ring numerals as bars of a digit's size on both axes, in the zones outside the two innermost (dark on paper, light on black). */
function numerals(face: TargetFace, paper = 226, black = 30): NonNullable<Scene['marks']> {
  const radii = face.rings.map((r) => r.diameter.value / 2).sort((a, b) => b - a)
  const blackR = face.blackDiameter.value / 2
  return radii.slice(0, -2).flatMap((r, i) => {
    const gap = r - defined(radii[i + 1])
    const mid = r - gap / 2
    const [height, grey] = [0.35 * gap, mid < blackR ? paper - 30 : black]
    const offsets: [number, number][] = [
      [mid, 0],
      [-mid, 0],
      [0, mid],
      [0, -mid],
    ]
    return offsets.map(([x, y]) => ({ x, y, width: 0.6 * height, height, grey }))
  })
}

/** A printed header (word boxes) above the face and the box line about it, face mm. */
function sheetPrint(outer: number): NonNullable<Scene['marks']> {
  const words: NonNullable<Scene['marks']> = []
  const lines: [number, number][] = [
    [1.24, 0.07],
    [1.13, 0.04],
  ]
  for (const [y, size] of lines)
    for (let x = -0.95, k = 0; x < 0.95; k++) {
      const width = defined([0.3, 0.15, 0.4, 0.2, 0.25][k % 5]) * (size / 0.07)
      words.push({
        x: (x + width / 2) * outer,
        y: y * outer,
        width: width * outer,
        height: size * outer,
        grey: 40,
      })
      x += width + 0.05
    }
  const t = 0.006 * outer
  const b = 1.05 * outer
  return [
    ...words,
    { x: 0, y: b, width: 2 * b, height: t, grey: 30 },
    { x: 0, y: -b, width: 2 * b, height: t, grey: 30 },
    { x: b, y: 0, width: t, height: 2 * b, grey: 30 },
    { x: -b, y: 0, width: t, height: 2 * b, grey: 30 },
  ]
}

/** Six holes in the black area, as shares of its radius. */
const holeSpots: [number, number][] = [
  [0.3, 0.2],
  [-0.45, 0.35],
  [0.55, -0.4],
  [-0.2, -0.55],
  [0.15, 0.7],
  [-0.65, -0.25],
]

/**
 * A sheet of `face` photographed as `kind`, 1200 x 900 px (`poor`: 640 x 480), with six holes of
 * `bullet` mm in its black area. `poor` has uneven light, a shadow, blur and noise; a test adds the
 * JPEG compression.
 */
export function photoScene(face: TargetFace, kind: PhotoKind, bullet: number): Scene {
  const [W, H] = kind === 'poor' ? [640, 480] : [1200, 900]
  const outer = defined(face.rings[0]).diameter.value / 2
  const blackR = face.blackDiameter.value / 2
  // the whole sheet, its header included, fills 90 % of the height; the line is 2.2 px wide there
  const whole = (0.9 * H) / (2.53 * outer)
  const line = (2.2 * H) / 900 / whole
  const sheet: Scene['sheet'] = {
    box: [-1.15 * outer, -1.15 * outer, 1.15 * outer, 1.38 * outer],
    background: 95,
  }
  const printed = { sheet, marks: [...sheetPrint(outer), ...numerals(face)] }
  const mid = (s: number) => ({ x: W / 2, y: H / 2 + 0.115 * outer * s })
  const camera = (s: number, more: Partial<Camera>): Camera => ({
    width: W,
    height: H,
    pxPerMm: s,
    depth: 5,
    ...more,
  })
  const views: Record<PhotoKind, Partial<Scene>> = {
    whole: { ...printed, camera: camera(whole, { tilt: 6, roll: 2, at: mid(whole) }) },
    insert: {
      sheet: { box: [-1.4 * blackR, -1.4 * blackR, 1.4 * blackR, 1.4 * blackR], background: 150 },
      marks: numerals(face),
      camera: camera(H / (2.24 * blackR), { roll: 4 }),
    },
    zoom: {
      ...printed,
      camera: camera((0.5 * H) / blackR, { roll: -3, at: { x: 0.5 * W, y: 0.42 * H } }),
    },
    corner: {
      ...printed,
      camera: camera((0.25 * H) / outer, { tilt: 5, at: { x: 0.2 * W, y: 0.24 * H } }),
    },
    cut: { ...printed, camera: camera((0.6 * H) / outer, { at: { x: 0.6 * W, y: 0.5 * H } }) },
    skewed: {
      ...printed,
      camera: camera(0.8 * whole, {
        tilt: 35,
        yaw: 25,
        roll: 12,
        depth: 1.8,
        at: mid(0.8 * whole),
      }),
    },
    poor: {
      ...printed,
      camera: camera(whole, { tilt: 8, roll: -4, at: mid(whole) }),
      // light falling off to the right and a soft shadow over the lower right
      light: (x, y) => {
        const t = Math.min(1, Math.max(0, (x + 0.5 * y - 0.75 * W) / (0.05 * W)))
        return (1 - 0.3 * (x / W)) * (1 - 0.45 * t)
      },
      blur: 1,
      noise: 6,
    },
  }
  return {
    face,
    line,
    noise: 2,
    holes: holeSpots.map(([x, y]) => ({ x: x * blackR, y: y * blackR, diameter: bullet })),
    holeGrey: 205,
    ...views[kind],
  } as Scene
}

async function jpeg(image: RgbaImage, quality: number): Promise<RgbaImage> {
  const raw = { width: image.width, height: image.height, channels: 4 as const }
  const { data, info } = await sharp(Buffer.from(image.data), { raw })
    .jpeg({ quality })
    .toBuffer()
    .then((b) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }))
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) }
}

export type Row = {
  photo: string
  /** 'right sure', 'right ask n' (the face among n offered), 'wrong ...' or '-' (none). */
  face: string
  centreMm: number
  scalePct: number
  /** Holes found of those in the photo, and proposals that are no hole. */
  holes: number
  of: number
  extra: number
}

/** The face search and the hole detection on `kind` of `id`, holes of `bullet` mm, against the truth. */
export async function measure(id: string, kind: PhotoKind, bullet: number): Promise<Row> {
  const face = faceById(id)
  const { image: drawn, h } = render(photoScene(face, kind, bullet))
  const image = kind === 'poor' ? await jpeg(drawn, 45) : drawn
  const search = findFace(image, faces)
  const fit: FaceFit | undefined = search.fits.find((f) => f.face.id === id) ?? search.fits[0]
  const row: Row = {
    photo: `${id} ${kind}`,
    face: !fit
      ? '-'
      : `${fit.face.id === id ? 'right' : 'wrong'} ${search.sure ? 'sure' : `ask ${search.fits.length}`}`,
    centreMm: Number.NaN,
    scalePct: Number.NaN,
    holes: 0,
    of: 0,
    extra: 0,
  }
  if (!fit) return row
  const c = project(h, { x: 0, y: 0 })
  const at = applyMatrix(fit.toFace, c)
  const [ex, ey] = [project(h, { x: 1, y: 0 }), project(h, { x: 0, y: 1 })]
  const local = Math.sqrt(Math.abs((ex.x - c.x) * (ey.y - c.y) - (ex.y - c.y) * (ey.x - c.x)))
  row.centreMm = Math.hypot(at.x, at.y)
  row.scalePct = 100 * (fit.pxPerMm / local - 1)
  const label = faceLabel(
    {
      toFace: fit.toFace,
      outer: fit.outer,
      black: fit.face.blackDiameter.value / 2,
      rings: fit.face.rings.map((r) => r.diameter.value / 2),
    },
    bullet,
  )
  const found =
    autoDetect({
      image,
      pxPerM: fit.pxPerMm * 1000,
      expectedHoleDiameter: bullet / 1000,
      face: label,
    })?.proposals ?? []
  const D = bullet * local
  const truth = (photoScene(face, kind, bullet).holes ?? [])
    .map((q) => project(h, q))
    .filter((p) => p.x >= 0 && p.y >= 0 && p.x < image.width && p.y < image.height)
  const used = new Set<number>()
  for (const t of truth) {
    const j = found.findIndex((p, k) => !used.has(k) && Math.hypot(p.x - t.x, p.y - t.y) <= D / 2)
    if (j >= 0) used.add(j)
  }
  return { ...row, holes: used.size, of: truth.length, extra: found.length - used.size }
}

/**
 * The face right, applied without a question (`sure`) or offered with the faces the photo cannot
 * tell apart, its centre within 0.6 % of the outer radius and its scale within 1 %.
 */
export function expectFace(row: Row, outer: number, sure: boolean) {
  expect(row.face).toMatch(sure ? /^right sure$/ : /^right ask \d+$/)
  expect(row.centreMm).toBeLessThan(0.006 * outer)
  expect(Math.abs(row.scalePct)).toBeLessThan(1)
}

/** At least `holes` of the six holes found, at most `extra` proposals that are no hole. */
export function expectHoles(row: Row, holes: number, extra: number) {
  expect(row.holes).toBeGreaterThanOrEqual(holes)
  expect(row.extra).toBeLessThanOrEqual(extra)
}
