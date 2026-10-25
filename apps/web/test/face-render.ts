// Synthetic photos of the target faces of packages/data/records/target-faces for the face search:
// the face drawn from its record, seen by a pinhole camera.
import { readdirSync, readFileSync } from 'node:fs'
import type { Federation, TargetFace } from '@open-reloading/schema'
import { type Face, withOrganization } from '../src/lib/face-organization.ts'
import type { RgbaImage } from '../src/lib/image.ts'
import { mul3, type Point, type Vector3 } from '../src/lib/target-geometry.ts'
import { defined } from './defined.ts'

const dir = new URL('../../../packages/data/records/target-faces/', import.meta.url)
const federationDir = new URL('../../../packages/data/records/federations/', import.meta.url)
const federations = readdirSync(federationDir).map(
  (f) => JSON.parse(readFileSync(new URL(f, federationDir), 'utf8')) as Federation,
)
export const faces: Face[] = readdirSync(dir)
  .sort()
  .map((f) =>
    withOrganization(JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as TargetFace, federations),
  )
export const faceById = (id: string) => {
  const f = faces.find((x) => x.id === id)
  if (!f) throw new Error(`No face ${id}`)
  return f
}

/** Face mm (x right, y up) to image px, a 3 x 3 matrix. */
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export type Camera = {
  width: number
  height: number
  /** Image px per face mm at the face centre, seen from the front. */
  pxPerMm: number
  /** Tilt of the face about the horizontal axis, degrees. */
  tilt?: number
  /** Turn about the vertical axis, degrees. */
  yaw?: number
  /** Roll of the photo, degrees. */
  roll?: number
  /** Image position of the face centre, px; default the middle. */
  at?: Point
  /** Distance of the camera in focal lengths of the 1 px/mm view: smaller is more perspective. */
  depth?: number
}

/** The homography of a pinhole camera that looks at the face centre. */
function camera(c: Camera): Homography {
  const rad = Math.PI / 180
  const [tx, ty, tz] = [(c.tilt ?? 0) * rad, (c.yaw ?? 0) * rad, (c.roll ?? 0) * rad]
  // rotation of the face plane: yaw about y, then tilt about x, then roll about z
  const rx: Homography = [1, 0, 0, 0, Math.cos(tx), -Math.sin(tx), 0, Math.sin(tx), Math.cos(tx)]
  const ry: Homography = [Math.cos(ty), 0, Math.sin(ty), 0, 1, 0, -Math.sin(ty), 0, Math.cos(ty)]
  const rz: Homography = [Math.cos(tz), -Math.sin(tz), 0, Math.sin(tz), Math.cos(tz), 0, 0, 0, 1]
  const R = mul3(rz, mul3(rx, ry))
  // the camera looks along z; the face plane lies `d` mm in front, a focal length of f px
  const depth = c.depth ?? 6
  const f = c.pxPerMm * 1000 * depth
  const d = 1000 * depth
  const at = c.at ?? { x: c.width / 2, y: c.height / 2 }
  // face (X, Y, 0) with Y up becomes camera coordinates (X, -Y, 0) then R, then z + d
  const cols: [Vector3, Vector3] = [
    [R[0], R[3], R[6]],
    [-R[1], -R[4], -R[7]],
  ]
  const t: Vector3 = [0, 0, d]
  const [c0, c1] = cols
  return [
    f * c0[0] + at.x * c0[2],
    f * c1[0] + at.x * c1[2],
    f * t[0] + at.x * t[2],
    f * c0[1] + at.y * c0[2],
    f * c1[1] + at.y * c1[2],
    f * t[1] + at.y * t[2],
    c0[2],
    c1[2],
    t[2],
  ]
}

export const project = (h: Homography, p: Point): Point => {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}

export function invert(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m
  const adj: Homography = [
    e * i - f * h,
    c * h - b * i,
    b * f - c * e,
    f * g - d * i,
    a * i - c * g,
    c * d - a * f,
    d * h - e * g,
    b * g - a * h,
    a * e - b * d,
  ]
  const det = a * adj[0] + b * adj[3] + c * adj[6]
  const [n0, n1, n2, n3, n4, n5, n6, n7, n8] = adj
  return [n0 / det, n1 / det, n2 / det, n3 / det, n4 / det, n5 / det, n6 / det, n7 / det, n8 / det]
}

export type Scene = {
  camera: Camera
  face: TargetFace
  /** Line width, mm. */
  line?: number
  /** Grey of the paper and of the black area. */
  paper?: number
  black?: number
  /** Gaussian noise (grey levels), blur radius (px). */
  noise?: number
  /** Holes: face mm, diameter mm; drawn with this grey (default the paper's). */
  holes?: Array<{ x: number; y: number; diameter: number }>
  holeGrey?: number
  /** Print marks (numerals): boxes centred at face mm, width and height in mm, drawn with this grey. */
  marks?: Array<{ x: number; y: number; width: number; height: number; grey: number }>
  /** Dark patches in image px: [x0, y0, x1, y1], grey. */
  patches?: Array<{ box: [number, number, number, number]; grey: number }>
  /** Brightness falling by this share across the image width. */
  gradient?: number
  /** Draw the ring lines (default true). */
  rings?: boolean
  /** The sheet's paper as a box of face mm [x0, y0, x1, y1]; outside it the background grey. */
  sheet?: { box: [number, number, number, number]; background: number }
  /** Brightness factor at image px (uneven light, a shadow). */
  light?: (x: number, y: number) => number
  /** Box blur radius, px, before the noise. */
  blur?: number
}

const rng = (seed: number) => {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

type Look = { radii: number[]; blackR: number; line: number; paper: number; black: number }

/** The scene as RGBA, drawn per pixel through the inverse homography with 2 x 2 samples. */
export function render(scene: Scene): { image: RgbaImage; h: Homography } {
  const { width, height } = scene.camera
  const h = camera(scene.camera)
  const inv = invert(h)
  const { face } = scene
  const radii = face.rings.map((r) => r.diameter.value / 2)
  if (face.innerTen) radii.push(face.innerTen.diameter.value / 2)
  const look: Look = {
    radii,
    blackR: face.blackDiameter.value / 2,
    line: scene.line ?? 0.5,
    paper: scene.paper ?? 226,
    black: scene.black ?? 30,
  }
  const grey = new Float32Array(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) grey[y * width + x] = pixelGrey(scene, look, inv, x, y)
  if (scene.blur) boxBlur(grey, width, height, scene.blur)
  if (scene.noise) addNoise(grey, scene.noise)
  const data = new Uint8ClampedArray(width * height * 4)
  for (const [i, v] of grey.entries()) {
    data[4 * i] = data[4 * i + 1] = data[4 * i + 2] = v
    data[4 * i + 3] = 255
  }
  return { image: { width, height, data }, h }
}

/** The grey of image pixel (x, y): the mean of 2 x 2 samples, the patches, the light. */
function pixelGrey(scene: Scene, look: Look, inv: Homography, x: number, y: number): number {
  const { width } = scene.camera
  let sum = 0
  for (let sy = 0; sy < 2; sy++)
    for (let sx = 0; sx < 2; sx++)
      sum += sampleGrey(scene, look, inv, x + 0.25 + 0.5 * sx, y + 0.25 + 0.5 * sy)
  let v = sum / 4
  for (const p of scene.patches ?? [])
    if (x >= p.box[0] && x < p.box[2] && y >= p.box[1] && y < p.box[3]) v = p.grey
  v *= (1 - (scene.gradient ?? 0) * (x / width)) * (scene.light?.(x, y) ?? 1)
  return v
}

/** The grey at image point (px, py): paper, black area, ring line, print mark or hole. */
function sampleGrey(scene: Scene, look: Look, inv: Homography, px: number, py: number): number {
  const { blackR, paper, black } = look
  const w = inv[6] * px + inv[7] * py + inv[8]
  const X = (inv[0] * px + inv[1] * py + inv[2]) / w
  const Y = (inv[3] * px + inv[4] * py + inv[5]) / w
  const r = Math.hypot(X, Y)
  const sh = scene.sheet?.box
  if (sh && (X < sh[0] || X > sh[2] || Y < sh[1] || Y > sh[3]))
    return scene.sheet?.background ?? paper
  let v = r <= blackR ? black : paper
  if (scene.rings !== false) v = ringGrey(look, r, v)
  return printGrey(scene, X, Y, v, paper)
}

/** `v` at face point (X, Y), or the grey of the print mark or hole that covers it. */
function printGrey(scene: Scene, X: number, Y: number, v: number, paper: number): number {
  let out = v
  for (const m of scene.marks ?? [])
    if (Math.abs(X - m.x) <= m.width / 2 && Math.abs(Y - m.y) <= m.height / 2) out = m.grey
  for (const hole of scene.holes ?? [])
    if (Math.hypot(X - hole.x, Y - hole.y) <= hole.diameter / 2) out = scene.holeGrey ?? paper
  return out
}

/** `v` at radius `r`, or the ring line's grey where a ring line passes. */
function ringGrey({ radii, blackR, line, paper, black }: Look, r: number, v: number): number {
  for (const rr of radii)
    if (Math.abs(r - rr) <= line / 2) return r <= blackR + line / 2 ? paper - 30 : black
  return v
}

function addNoise(grey: Float32Array, noise: number) {
  const rand = rng(11)
  for (const [i, v] of grey.entries()) {
    // Box-Muller
    const g = Math.sqrt(-2 * Math.log(rand() + 1e-9)) * Math.cos(2 * Math.PI * rand())
    grey[i] = v + noise * g
  }
}

/** Three passes of a box blur of radius `r` px over rows and columns, in place. */
function boxBlur(g: Float32Array, w: number, h: number, r: number) {
  const k = Math.max(1, Math.round(r))
  const pass = (n: number, len: number, at: (i: number, j: number) => number) => {
    const line = new Float32Array(len)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < len; j++) line[j] = defined(g[at(i, j)])
      for (let j = 0; j < len; j++) {
        let s = 0
        for (let d = -k; d <= k; d++) s += defined(line[Math.min(len - 1, Math.max(0, j + d))])
        g[at(i, j)] = s / (2 * k + 1)
      }
    }
  }
  for (let t = 0; t < 3; t++) {
    pass(h, w, (y, x) => y * w + x)
    pass(w, h, (x, y) => y * w + x)
  }
}
