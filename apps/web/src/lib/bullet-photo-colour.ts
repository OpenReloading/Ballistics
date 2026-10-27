/**
 * The cut-out for a bullet whose brightness is close to the background's but whose colour is not
 * (copper on grey, brass on green): the colour distance along the line from the background's
 * colour to the bullet's takes the place of the luma (`apps/docs/docs/models/bullet-photo.md`).
 * Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import { type Gray, grayOf, lowContrast, type Segmentation, segment } from './bullet-photo.ts'
import type { RgbaImage } from './image.ts'
import type { Point } from './target-geometry.ts'

type Rgb = [number, number, number]

/** The median of each channel over the ring along the photograph's edge (a ruler or bar reaching it stays a minority). */
function borderColour(img: RgbaImage): Rgb {
  const { width: w, height: h, data } = img
  const k = Math.max(2, Math.round(0.01 * Math.min(w, h)))
  const hist = [0, 1, 2].map(() => new Float64Array(256))
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const [x, y] = [i % w, Math.floor(i / w)]
    if (x >= k && y >= k && x < w - k && y < h - k) continue
    hist.forEach((hc, c) => {
      const v = Math.min(255, data[4 * i + c] ?? 0)
      hc[v] = (hc[v] ?? 0) + 1
    })
    n++
  }
  return hist.map((hc) => {
    let seen = 0
    for (let v = 0; v < 256; v++) {
      seen += hc[v] ?? 0
      if (seen >= n / 2) return v
    }
    return 255
  }) as Rgb
}

const colourAt = (img: RgbaImage, i: number): Rgb => [
  img.data[4 * i] ?? 0,
  img.data[4 * i + 1] ?? 0,
  img.data[4 * i + 2] ?? 0,
]

/** The median colour of the 5 x 5 pixels about `p`. */
function patchColour(img: RgbaImage, p: Point): Rgb {
  const px = (dx: number, dy: number) =>
    colourAt(
      img,
      Math.min(img.height - 1, Math.max(0, Math.round(p.y) + dy)) * img.width +
        Math.min(img.width - 1, Math.max(0, Math.round(p.x) + dx)),
    )
  const patch = [-2, -1, 0, 1, 2].flatMap((dy) => [-2, -1, 0, 1, 2].map((dx) => px(dx, dy)))
  return [0, 1, 2].map((c) => [...patch].sort((a, b) => a[c as 0] - b[c as 0])[12]?.[c] ?? 0) as Rgb
}

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

/** The grey level the background takes in the projection, so noise below it is not cut off at 0. */
const floor = 30

/** The span of grey levels the bullet's colour is spread over in the projection. */
const span = 200

/** The mean of the samples `takes` chooses; undefined for none. */
function meanOf(sample: readonly Rgb[], takes: (c: Rgb) => boolean): Rgb | undefined {
  const sum: Rgb = [0, 0, 0]
  let count = 0
  for (const c of sample) {
    if (!takes(c)) continue
    for (let k = 0; k < 3; k++) sum[k] = (sum[k] ?? 0) + (c[k] ?? 0)
    count++
  }
  return count ? (sum.map((v) => v / count) as Rgb) : undefined
}

/**
 * The colour of the bullet: the mean of the samples furthest from the background `bg`, refined
 * over 3 assignments of each sample to the nearer of the two colours, leaving out the colours in
 * `avoid`. Undefined when no sample is 20 levels from `bg`.
 */
function bulletColour(sample: readonly Rgb[], bg: Rgb, avoid: readonly Rgb[]): Rgb | undefined {
  // a ruler is the furthest from the background in colour, often: its colours (where the user
  // placed the scale points) are not the bullet's
  const own = sample.filter((c) => avoid.every((a) => distance(c, a) > 0.4 * distance(a, bg)))
  const dist = own.map((c) => distance(c, bg)).sort((a, b) => a - b)
  const far = dist[Math.floor(0.98 * dist.length)] ?? 0
  let fg = far < 20 ? undefined : meanOf(own, (c) => distance(c, bg) >= 0.8 * far)
  for (let pass = 0; pass < 3 && fg; pass++) {
    const was = fg
    fg = meanOf(own, (c) => distance(c, was) < distance(c, bg))
  }
  return fg && distance(fg, bg) >= 20 ? fg : undefined
}

/**
 * The photograph as the distance of each pixel's colour from the background's along the line to the
 * bullet's colour (the background's from the photograph's border, the bullet's by `bulletColour`),
 * with the background near `floor` and the bullet near `floor + span`. Undefined when the
 * photograph has one colour.
 */
function colourSeparation(img: RgbaImage, avoid: readonly Point[] = []): Gray | undefined {
  const n = img.width * img.height
  const stride = Math.max(1, Math.floor(Math.sqrt(n / 40000)))
  const bg = borderColour(img)
  const fg = bulletColour(
    Array.from({ length: Math.ceil(n / stride) }, (_, k) => colourAt(img, k * stride)),
    bg,
    avoid.map((p) => patchColour(img, p)),
  )
  if (!fg) return
  const reach = distance(fg, bg)
  const u = fg.map((v, k) => (v - (bg[k] ?? 0)) / reach) as Rgb
  const data = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const c = colourAt(img, i)
    const along = (c[0] - bg[0]) * u[0] + (c[1] - bg[1]) * u[1] + (c[2] - bg[2]) * u[2]
    data[i] = Math.min(255, Math.max(0, floor + (along * span) / reach))
  }
  return { width: img.width, height: img.height, data }
}

/**
 * The cut-out of a photograph: by luma, and when the bullet is within `lowContrast` grey levels of
 * the background in luma, by colour too, whichever separates them further (the colour projection
 * puts the bullet `span` levels from the background).
 */
export function segmentPhoto(img: RgbaImage, exclude: readonly Point[] = []): Segmentation {
  const luma = segment(grayOf(img), exclude)
  if (luma.contrast >= lowContrast) return luma
  const projection = colourSeparation(img, exclude)
  if (!projection) return luma
  const colour = segment(projection, exclude)
  return colour.contrast > 1.5 * luma.contrast ? colour : luma
}
