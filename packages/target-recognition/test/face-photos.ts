import { applyMatrix } from '@open-reloading/shot-groups'
import sharp from 'sharp'
import { expect } from 'vitest'
import { findFace } from '../src/face-search.ts'
import { autoDetect } from '../src/hole-detection.ts'
import type { RgbaImage } from '../src/image.ts'
import { type FaceFit, type FaceSearch, faceLabel, type PrintedFace } from '../src/target-face.ts'
import { defined } from './defined.ts'
import {
  type Camera,
  faceById,
  faces,
  type Homography,
  project,
  render,
  type Scene,
} from './face-render.ts'

// The photos people take of a sheet (`photoScene`): the face search and the hole detection on the face it finds, as the editor runs them; one test file per face, so they run in parallel.

/** The photos people take of a sheet: the whole sheet, the insert card, zoomed in, off center, cut at the edges, skewed, poor. */
export const photoKinds = ['whole', 'insert', 'zoom', 'corner', 'cut', 'skewed', 'poor'] as const
export type PhotoKind = (typeof photoKinds)[number]

/** Ring numerals as bars of a digit's size on both axes, in the zones outside the two innermost (dark on paper, light on black). */
function numerals(face: PrintedFace, paper = 226, black = 30): NonNullable<Scene['marks']> {
  const radii = face.rings.map((r) => r.diameter.value / 2).toSorted((a, b) => b - a)
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

/** 1200 x 900 px (`poor`: 640 x 480 with uneven light, a shadow, blur and noise), six holes of `bullet` mm in the black area; a test adds the JPEG compression. */
export function photoScene(face: PrintedFace, kind: PhotoKind, bullet: number): Scene {
  const [W, H] = kind === 'poor' ? [640, 480] : [1200, 900]
  const outer = defined(face.rings[0]).diameter.value / 2
  const blackR = face.blackDiameter.value / 2
  // the whole sheet, its header included, fills 90 % of the height; the line is 2.2 px wide there
  const whole = (0.9 * H) / (2.53 * outer)
  const line = (2.2 * H) / 900 / whole
  const views = viewsOf(face, [W, H], whole)
  return {
    face,
    line,
    noise: 2,
    holes: holeSpots.map(([x, y]) => ({ x: x * blackR, y: y * blackR, diameter: bullet })),
    holeGrey: 205,
    ...views[kind],
  } as Scene
}

/** A camera of a `W` by `H` px photo at `s` px per mm, depth 5 unless `more` says otherwise. */
const cameraOf =
  (W: number, H: number) =>
  (s: number, more: Partial<Camera>): Camera => ({
    width: W,
    height: H,
    pxPerMm: s,
    depth: 5,
    ...more,
  })

/** Light falling off to the right and a soft shadow over the lower right of a photo `W` px wide. */
const shadowLight =
  (W: number) =>
  (x: number, y: number): number => {
    const t = Math.min(1, Math.max(0, (x + 0.5 * y - 0.75 * W) / (0.05 * W)))
    return (1 - 0.3 * (x / W)) * (1 - 0.45 * t)
  }

/** The camera, the print and the light of each kind of photo of a `W` by `H` px photo; `whole` px per mm shows the whole sheet. */
function viewsOf(
  face: PrintedFace,
  [W, H]: [number, number],
  whole: number,
): Record<PhotoKind, Partial<Scene>> {
  const outer = defined(face.rings[0]).diameter.value / 2
  const blackR = face.blackDiameter.value / 2
  const sheet: Scene['sheet'] = {
    box: [-1.15 * outer, -1.15 * outer, 1.15 * outer, 1.38 * outer],
    background: 95,
  }
  const printed = { sheet, marks: [...sheetPrint(outer), ...numerals(face)] }
  const mid = (s: number) => ({ x: W / 2, y: H / 2 + 0.115 * outer * s })
  const camera = cameraOf(W, H)
  return {
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
      light: shadowLight(W),
      blur: 1,
      noise: 6,
    },
  }
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
  /** The first choice right or not, and the rings its face matched: the counts `confidenceOf` takes. */
  first: { right: boolean; rings: number } | undefined
}

/** The search's first choice right or not, with the rings its face matched. */
function firstChoice(search: ReturnType<typeof findFace>, id: string): Row['first'] {
  const top = search.fits[0]
  const rings = top && search.ranked.find((r) => r.id === top.face.id)?.matched
  return top && rings !== undefined ? { right: top.face.id === id, rings } : undefined
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
    face: verdict(search, fit, id),
    centreMm: Number.NaN,
    scalePct: Number.NaN,
    holes: 0,
    of: 0,
    extra: 0,
    first: firstChoice(search, id),
  }
  if (!fit) return row
  const c = project(h, { x: 0, y: 0 })
  const at = applyMatrix(fit.toFace, c)
  const [ex, ey] = [project(h, { x: 1, y: 0 }), project(h, { x: 0, y: 1 })]
  const local = Math.sqrt(Math.abs((ex.x - c.x) * (ey.y - c.y) - (ex.y - c.y) * (ey.x - c.x)))
  row.centreMm = Math.hypot(at.x, at.y)
  row.scalePct = 100 * (fit.pxPerMm / local - 1)
  return { ...row, ...holesFound({ face, kind, bullet }, { image, h }, fit, local) }
}

/** `Row.face` of the search: '-' without a fit, else right or wrong, sure or the number of faces offered. */
function verdict(search: FaceSearch, fit: FaceFit | undefined, id: string): string {
  if (!fit) return '-'
  return `${fit.face.id === id ? 'right' : 'wrong'} ${search.sure ? 'sure' : `ask ${search.fits.length}`}`
}

/** The hole detection on the face of `fit`: the holes of the scene found, of those on the photo, and the proposals that are no hole. */
function holesFound(
  { face, kind, bullet }: { face: PrintedFace; kind: PhotoKind; bullet: number },
  { image, h }: { image: RgbaImage; h: Homography },
  fit: FaceFit,
  local: number,
): Pick<Row, 'holes' | 'of' | 'extra'> {
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
  return { holes: used.size, of: truth.length, extra: found.length - used.size }
}

/** The face right, applied without a question (`sure`) or offered with the faces the photo cannot tell apart, its center within 0.6 % of the outer radius and its scale within 1 %. */
export function expectFace(row: Row, outer: number, sure: boolean): void {
  expect(row.face).toMatch(sure ? /^right sure$/ : /^right ask \d+$/)
  expect(row.centreMm).toBeLessThan(0.006 * outer)
  expect(Math.abs(row.scalePct)).toBeLessThan(1)
}

/** At least `holes` of the six holes found, at most `extra` proposals that are no hole. */
export function expectHoles(row: Row, holes: number, extra: number): void {
  expect(row.holes).toBeGreaterThanOrEqual(holes)
  expect(row.extra).toBeLessThanOrEqual(extra)
}

/** Right and wrong first choices by the rings matched, one line per ring count, for the test output. */
export function firstChoices(rows: readonly Row[]): string {
  const counts = new Map<number, { right: number; wrong: number }>()
  for (const { first } of rows) {
    if (!first) continue
    const c = counts.get(first.rings) ?? { right: 0, wrong: 0 }
    c[first.right ? 'right' : 'wrong']++
    counts.set(first.rings, c)
  }
  return [...counts]
    .toSorted(([a], [b]) => a - b)
    .map(([rings, c]) => `${rings} rings: right ${c.right}, wrong ${c.wrong}`)
    .join('\n')
}
