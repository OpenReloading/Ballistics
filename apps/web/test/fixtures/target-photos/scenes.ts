/**
 * Synthetic target photos for the hole detection recall test: rendered faces with torn holes
 * smaller than the bullet, as paper shows them. `make.mts` writes the files and `holes.json`; the
 * test reads the files, so JPEG artefacts, blur and noise are part of the fixture.
 */

import { seededRandom } from '../../../src/lib/ellipse.ts'
import { defined } from '../../defined.ts'

type Rgb = [number, number, number]

export type Scene = {
  file: string
  about: string
  width: number
  height: number
  pxPerMm: number
  /** Bullet diameter, mm. */
  caliberMm: number
  /** Visible hole diameter over the bullet diameter. */
  visible: number
  face: 'rings' | 'dark' | 'night' | 'orange'
  /** Hole centres in scene px (before the tilt). */
  holes: { x: number; y: number }[]
  /** Photo tilt, degrees counter-clockwise. */
  tilt: number
  /** Uneven light: brightness falls by this share across the photo. */
  gradient: number
  noise: number
  blur: number
  /** JPEG quality. */
  jpeg: number
}

const PAPER: Rgb = [232, 230, 222]
const BLACK: Rgb = [28, 28, 30]
/** A dark face seen by a phone in dim light, and the backing seen through its holes. */
const NIGHT: Rgb = [46, 46, 50]
const NIGHT_HOLE: Rgb = [10, 10, 12]
const NIGHT_RIM: Rgb = [76, 74, 72]

export const scenes: Scene[] = [
  {
    file: 'scan-light.jpg',
    about:
      'scan of a light face with black rings and a black centre, dark backing, 0.8 of the bullet',
    width: 560,
    height: 560,
    pxPerMm: 8,
    caliberMm: 5.56,
    visible: 0.8,
    face: 'rings',
    holes: [
      { x: 200, y: 210 },
      { x: 330, y: 190 },
      { x: 240, y: 150 },
      { x: 272, y: 150 },
      { x: 180, y: 360 },
      { x: 380, y: 350 },
      { x: 300, y: 410 },
    ],
    tilt: 0,
    gradient: 0.03,
    noise: 3,
    blur: 0.6,
    jpeg: 92,
  },
  {
    file: 'phone-light.jpg',
    about: 'phone photo of a light face: tilt, uneven light, blur, JPEG, 0.7 of the bullet',
    width: 640,
    height: 640,
    pxPerMm: 6,
    caliberMm: 7.62,
    visible: 0.7,
    face: 'rings',
    holes: [
      { x: 230, y: 240 },
      { x: 400, y: 230 },
      { x: 280, y: 262 },
      { x: 309, y: 262 },
      { x: 220, y: 420 },
      { x: 430, y: 400 },
    ],
    tilt: 4,
    gradient: 0.25,
    noise: 5,
    blur: 1.2,
    jpeg: 72,
  },
  {
    file: 'phone-dark.jpg',
    about:
      'phone photo of a dark face: holes show the light board, as light as the paper, 0.7 of the bullet',
    width: 640,
    height: 640,
    pxPerMm: 6,
    caliberMm: 7.62,
    visible: 0.7,
    face: 'dark',
    holes: [
      { x: 260, y: 260 },
      { x: 380, y: 250 },
      { x: 320, y: 320 },
      { x: 250, y: 380 },
      { x: 390, y: 390 },
      { x: 318, y: 440 },
    ],
    tilt: -3,
    gradient: 0.2,
    noise: 5,
    blur: 1,
    jpeg: 75,
  },
  {
    file: 'phone-night.jpg',
    about:
      'phone photo of a dark face in dim light: holes as dark as the backing behind them, lighter torn rims, 0.7 of the bullet',
    width: 640,
    height: 640,
    pxPerMm: 6,
    caliberMm: 7.62,
    visible: 0.7,
    face: 'night',
    holes: [
      { x: 262, y: 250 },
      { x: 304, y: 236 },
      { x: 372, y: 262 },
      { x: 236, y: 318 },
      { x: 318, y: 316 },
      { x: 396, y: 340 },
      { x: 270, y: 392 },
      { x: 346, y: 404 },
      { x: 300, y: 448 },
      { x: 412, y: 410 },
    ],
    tilt: -3,
    gradient: 0.2,
    noise: 5,
    blur: 1,
    jpeg: 75,
  },
  {
    file: 'scan-orange.jpg',
    about:
      'scan of an orange face on a black diamond: light holes with burnt dark rims, 0.8 of the bullet',
    width: 520,
    height: 520,
    pxPerMm: 8,
    caliberMm: 5.7,
    visible: 0.8,
    face: 'orange',
    holes: [
      { x: 230, y: 220 },
      { x: 300, y: 235 },
      { x: 255, y: 290 },
      { x: 320, y: 310 },
      { x: 215, y: 330 },
    ],
    tilt: 0,
    gradient: 0.04,
    noise: 4,
    blur: 0.7,
    jpeg: 85,
  },
]

/** The face colour at scene point (x, y), holes left out. */
function faceAt(s: Scene, x: number, y: number): Rgb {
  const [cx, cy] = [s.width / 2, s.height / 2]
  const r = Math.hypot(x - cx, y - cy) / s.pxPerMm
  if (s.face === 'rings') return ringsFaceAt(r)
  if (s.face === 'dark') return darkFaceAt(r)
  if (s.face === 'night') return nightFaceAt(r)
  // orange: a black diamond holding an orange disc
  if (Math.abs(x - cx) + Math.abs(y - cy) > 30 * s.pxPerMm) return PAPER
  return r < 18 ? [228, 112, 34] : BLACK
}

function ringsFaceAt(r: number): Rgb {
  if (r < 6) return BLACK
  for (const ring of [12, 20, 28, 36]) if (Math.abs(r - ring) < 0.35) return BLACK
  return PAPER
}

function nightFaceAt(r: number): Rgb {
  if (r >= 32) return PAPER
  for (const ring of [10, 18, 26]) if (Math.abs(r - ring) < 0.3) return [140, 140, 136]
  return NIGHT
}

function darkFaceAt(r: number): Rgb {
  if (r >= 32) return PAPER
  for (const ring of [10, 18, 26]) if (Math.abs(r - ring) < 0.3) return [200, 200, 195]
  return BLACK
}

/** The colour of a hole at distance `d` from its centre with the torn `edge`, `rv` the mean radius; undefined outside. */
function holeColourAt(s: Scene, d: number, edge: number, rv: number): Rgb | undefined {
  if (d <= edge) {
    if (s.face === 'rings') return [58, 56, 54]
    if (s.face === 'dark') return [226, 224, 216]
    if (s.face === 'night') return NIGHT_HOLE
    return [240, 234, 214]
  }
  // bullet wipe on paper, a burnt rim on the orange face
  if (s.face === 'rings' && d <= edge + 0.12 * rv) return [90, 88, 86]
  if (s.face === 'night' && d <= edge + 0.15 * rv) return NIGHT_RIM
  if (s.face === 'orange' && d <= edge + 0.2 * rv) return [46, 34, 26]
  return undefined
}

/** The scene colour at (x, y): face, holes with torn edges and their rims. */
function sceneAt(s: Scene, x: number, y: number, phase: number[]): Rgb {
  const rv = (s.caliberMm * s.visible * s.pxPerMm) / 2
  for (let i = 0; i < s.holes.length; i++) {
    const h = defined(s.holes[i])
    const d = Math.hypot(x - h.x, y - h.y)
    if (d > 1.3 * rv) continue
    const a = Math.atan2(y - h.y, x - h.x)
    const edge =
      rv *
      (1 +
        0.06 * Math.sin(5 * a + defined(phase[2 * i])) +
        0.03 * Math.sin(11 * a + defined(phase[2 * i + 1])))
    const colour = holeColourAt(s, d, edge, rv)
    if (colour) return colour
  }
  return faceAt(s, x, y)
}

/** Scene point to photo point: the tilt about the middle, counter-clockwise on screen. */
export function tilted(s: Scene, p: { x: number; y: number }, inverse = false) {
  const a = ((inverse ? -1 : 1) * s.tilt * Math.PI) / 180
  const [cx, cy] = [s.width / 2, s.height / 2]
  const [dx, dy] = [p.x - cx, p.y - cy]
  return {
    x: cx + Math.cos(a) * dx + Math.sin(a) * dy,
    y: cy - Math.sin(a) * dx + Math.cos(a) * dy,
  }
}

/** RGB bytes of the photo before blur and compression. */
export function render(s: Scene): Uint8Array {
  const rnd = seededRandom(s.width * 31 + s.holes.length)
  const phase = s.holes.flatMap(() => [rnd() * 6, rnd() * 6])
  const out = new Uint8Array(s.width * s.height * 3)
  for (let v = 0; v < s.height; v++)
    for (let u = 0; u < s.width; u++) {
      const q = tilted(s, { x: u, y: v }, true)
      const c = sceneAt(s, q.x, q.y, phase)
      const light = 1 - s.gradient * (0.7 * (u / s.width) + 0.3 * (v / s.height))
      for (let k = 0; k < 3; k++) {
        // Box-Muller noise
        const n = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())
        out[(v * s.width + u) * 3 + k] = Math.max(
          0,
          Math.min(255, defined(c[k]) * light + s.noise * n),
        )
      }
    }
  return out
}
