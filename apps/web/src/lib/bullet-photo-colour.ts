/**
 * The cut-out for a bullet whose brightness is close to the background's but whose colour is not
 * (copper on grey, brass on green): the colour distance along the line from the background's
 * colour to the bullet's takes the place of the luma (`apps/docs/docs/models/bullet-photo.md`).
 * Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */

import { msg } from '../i18n/translate.ts'
import {
  type Gray,
  grayOf,
  lowContrast,
  morphN,
  type Segmentation,
  segment,
} from './bullet-photo.ts'
import type { RgbaImage } from './image.ts'
import type { Point } from './target-geometry.ts'
import type { Wording } from './wording.ts'

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

/** The weight of the chroma's distance from the background's against the luma's in `deviation`. */
const chromaWeight = 1.5

/** The colour's departure from grey: each channel less the mean of the three. */
const chromaOf = ([r, g, b]: Rgb): Rgb => {
  const m = (r + g + b) / 3
  return [r - m, g - m, b - m]
}

/** The median of `v`, which is sorted in place. */
const medianOf = (v: Float32Array): number => v.sort()[v.length >> 1] ?? 0

const lumaOf = ([r, g, b]: Rgb) => 0.299 * r + 0.587 * g + 0.114 * b

/** The pixel indexes of line `line` of `img`: a column when `column`, else a row. */
const lineOf = (img: RgbaImage, line: number, column: boolean): number[] =>
  column
    ? Array.from({ length: img.height }, (_, y) => y * img.width + line)
    : Array.from({ length: img.width }, (_, x) => line * img.width + x)

/** The luma and the chroma of the colours of a line outside `known`, by median; the border's for a line with few of them. */
function lineBackground(
  img: RgbaImage,
  line: readonly number[],
  known: Uint8Array,
  border: Rgb,
  scratch: Float32Array[],
): number[] {
  let n = 0
  for (const i of line) {
    if (known[i]) continue
    const c = colourAt(img, i)
    const values = [lumaOf(c), ...chromaOf(c)]
    scratch.forEach((v, k) => {
      v[n] = values[k] ?? 0
    })
    n++
  }
  return n >= 8
    ? scratch.map((v) => medianOf(v.subarray(0, n)))
    : [lumaOf(border), ...chromaOf(border)]
}

/** The largest share of a line the bullet may take for the median of the line to be the background's. */
const bodyShare = 0.4

/** True when the columns give the background: the rows are mostly the bullet's (a bullet across the photograph) and the columns are not. */
function byColumns(known: Uint8Array, w: number, h: number): boolean {
  const [xs, ys] = [new Set<number>(), new Set<number>()]
  known.forEach((v, i) => {
    if (!v) return
    xs.add(i % w)
    ys.add(Math.floor(i / w))
  })
  return xs.size > bodyShare * w && ys.size <= bodyShare * h
}

/**
 * How far each pixel is from the background of its line in luma, in either direction, or in chroma
 * (weighted), whichever is greater, with the background at `floor`. The background of a line is the
 * median of its pixels outside `known` (a first cut-out): of a row, or of a column when the bullet
 * lies across the rows. A bullet darker than the background on one side and brighter on the other
 * (a highlight) is one body in it, a pale copper side with the background's luma stands out by its
 * colour, and a background of two tones (wall and table) is the background in each.
 */
function deviation(img: RgbaImage, known: Uint8Array): Gray {
  const { width: w, height: h } = img
  const border = borderColour(img)
  const column = byColumns(known, w, h)
  const scratch = [0, 1, 2, 3].map(() => new Float32Array(column ? h : w))
  const data = new Float32Array(w * h)
  for (let l = 0; l < (column ? w : h); l++) {
    const line = lineOf(img, l, column)
    const [yb, ...cb] = lineBackground(img, line, known, border, scratch)
    for (const i of line) {
      const c = colourAt(img, i)
      const dc = distance(chromaOf(c), cb as Rgb)
      data[i] = Math.min(255, floor + Math.max(Math.abs(lumaOf(c) - (yb ?? 0)), chromaWeight * dc))
    }
  }
  return { width: w, height: h, data }
}

/** The count of cut-out pixels of `a`, and how many of them `b` has too. */
function overlap(a: Uint8Array, b: Uint8Array): [number, number] {
  let [n, shared] = [0, 0]
  for (let i = 0; i < a.length; i++) {
    if (!a[i]) continue
    n++
    if (b[i]) shared++
  }
  return [n, shared]
}

/** True when `wide` takes in what `luma` found and over 10% more. */
function takesIn(wide: Segmentation, luma: Segmentation): boolean {
  const [n, shared] = overlap(luma.alpha, wide.alpha)
  return shared >= 0.8 * n && overlap(wide.alpha, luma.alpha)[0] > 1.1 * n
}

/**
 * The boundary pixels of a cut-out per root of its area. A bullet's outline is smooth: 2 (L + d) /
 * sqrt(L d) for a body L long and d across, 7 at 10 diameters long. A patch of a textured surface
 * has a far longer edge.
 */
function raggedness({ alpha, width: w, height: h }: Segmentation): number {
  const mask = alpha.map((v) => (v >= 128 ? 1 : 0))
  const box = { x0: w, y0: h, x1: -1, y1: -1 }
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const [x, y] = [i % w, Math.floor(i / w)]
    box.x0 = Math.min(box.x0, x)
    box.x1 = Math.max(box.x1, x)
    box.y0 = Math.min(box.y0, y)
    box.y1 = Math.max(box.y1, y)
  }
  if (box.x1 < 0) return Number.POSITIVE_INFINITY
  const pad = 3
  box.x0 = Math.max(0, box.x0 - pad)
  box.y0 = Math.max(0, box.y0 - pad)
  box.x1 = Math.min(w - 1, box.x1 + pad)
  box.y1 = Math.min(h - 1, box.y1 + pad)
  // a closing takes the slit between a dark and a bright side of the bullet out of the edge
  const closed = morphN(morphN(mask, w, box, false, 1), w, box, true, 1)
  const on = (i: number) => (closed[i] ?? 0) > 0
  let [count, edge] = [0, 0]
  for (let i = 0; i < closed.length; i++) {
    if (!on(i)) continue
    count++
    const x = i % w
    if (x === 0 || x === w - 1 || !(on(i - 1) && on(i + 1) && on(i - w) && on(i + w))) edge++
  }
  return edge / Math.sqrt(count)
}

/** Above this the edge of a cut-out is a surface's texture, not a bullet's outline. */
const ragged = 9

const raggedNote = msg(
  'The cut-out has a ragged edge: the background may be textured or busy. A plain background gives a better cut-out.',
)

const rough = (s: Segmentation) => raggedness(s) > ragged

const area = (s: Segmentation) => s.alpha.reduce((n, v) => n + (v >= 128 ? 1 : 0), 0)

/** A way to cut the bullet out: `known` is a cut-out already found, which the cut by deviation reads the background around. */
type Cut = (
  img: RgbaImage,
  exclude: readonly Point[],
  known: Uint8Array,
) => Segmentation | undefined

const byLuma: Cut = (img, exclude) => segment(grayOf(img), exclude)

const byColour: Cut = (img, exclude) => {
  const projection = colourSeparation(img, exclude)
  return projection && segment(projection, exclude)
}

const byDeviation: Cut = (img, exclude, known) => segment(deviation(img, known), exclude)

/** The cut-out chosen on a reduced photograph, and how to make it on the photograph itself. */
interface Pick {
  seg: Segmentation
  cut: Cut
  /** The cut-out `cut` reads the background around, when it is not the photograph's own. */
  known?: Uint8Array
  /** Sentences for the user about the choice itself, which the cut-out made on the photograph needs too. */
  notes?: Wording[]
}

/**
 * The cut of `img` that separates the bullet best. A bullet within `lowContrast` grey levels of
 * the background in luma is cut by colour when that contrast is greater. A bullet with a part of
 * its surface brighter and a part darker than the background (copper with a highlight on grey) is
 * cut by the luma's distance from the background's, or by colour, when that takes in what the first
 * cut found and more. When the result has a ragged edge (a patch of the background's texture) the
 * largest of the other cut-outs with a smooth edge is taken; none, and the user is told.
 */
function pickCut(img: RgbaImage, exclude: readonly Point[]): Pick {
  const luma = byLuma(img, exclude, new Uint8Array(0)) as Segmentation
  const colour = byColour(img, exclude, luma.alpha)
  const useColour = colour && luma.contrast < lowContrast && colour.contrast > 1.5 * luma.contrast
  const [first, firstCut] = useColour ? [colour, byColour] : [luma, byLuma]
  const both = byDeviation(img, exclude, first.alpha) as Segmentation
  const wide = [
    { seg: both, cut: byDeviation, known: first.alpha },
    colour && { seg: colour, cut: byColour },
  ].find((c) => c && c.seg !== first && takesIn(c.seg, first))
  const picked: Pick = wide ?? { seg: first, cut: firstCut }
  if (area(picked.seg) === 0 || !rough(picked.seg)) return picked
  const plainKnown = new Uint8Array(img.width * img.height)
  const plain = byDeviation(img, exclude, plainKnown) as Segmentation
  const options: Pick[] = [
    { seg: first, cut: firstCut },
    { seg: luma, cut: byLuma },
    { seg: both, cut: byDeviation, known: first.alpha },
    ...(colour ? [{ seg: colour, cut: byColour }] : []),
    { seg: plain, cut: byDeviation, known: plainKnown },
  ]
  const smooth = options
    .filter((o) => area(o.seg) > 0 && !rough(o.seg))
    .sort((a, b) => area(b.seg) - area(a.seg))[0]
  return smooth ?? { ...picked, notes: [raggedNote] }
}

/** The longest side of the photograph the cut is chosen on, px. */
const chooseLong = 900

/** The mean of channel `c` over the k x k block of `img` at block (`x`, `y`). */
function blockMean(img: RgbaImage, k: number, x: number, y: number, c: number): number {
  let sum = 0
  for (let j = 0; j < k; j++)
    for (let i = 0; i < k; i++) sum += img.data[4 * ((y * k + j) * img.width + x * k + i) + c] ?? 0
  return sum / (k * k)
}

/** `img` shrunk by the whole factor `k`, each pixel the mean of a k x k block. */
function reduced(img: RgbaImage, k: number): RgbaImage {
  const [w, h] = [Math.floor(img.width / k), Math.floor(img.height / k)]
  const data = new Uint8ClampedArray(4 * w * h)
  for (let i = 0; i < data.length; i++)
    data[i] = blockMean(img, k, (i >> 2) % w, Math.floor(i / 4 / w), i & 3)
  return { width: w, height: h, data }
}

/** The mask of `small` (a reduction by `k`) as one of the size `[w, h]`. */
function enlarged(small: Uint8Array, k: number, sw: number, [w, h]: [number, number]): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) {
    const [x, y] = [Math.floor((i % w) / k), Math.floor(i / w / k)]
    out[i] =
      (small[Math.min(y, Math.floor(h / k) - 1) * sw + Math.min(x, sw - 1)] ?? 0) >= 128 ? 1 : 0
  }
  return out
}

/**
 * The cut-out of a photograph. The way to cut it is chosen on a photograph reduced to
 * `chooseLong` px (`pickCut`), and the photograph itself is cut that way once.
 */
export function segmentPhoto(img: RgbaImage, exclude: readonly Point[] = []): Segmentation {
  const k = Math.max(1, Math.ceil(Math.max(img.width, img.height) / chooseLong))
  const small = k === 1 ? img : reduced(img, k)
  const picked = pickCut(
    small,
    exclude.map((p) => ({ x: p.x / k, y: p.y / k })),
  )
  const known = picked.known && enlarged(picked.known, k, small.width, [img.width, img.height])
  // a cut that finds nothing at full size (its colour is judged on a sample) falls back to luma, of the photograph's size
  const seg =
    k === 1
      ? picked.seg
      : (picked.cut(img, exclude, known ?? new Uint8Array(0)) ?? segment(grayOf(img), exclude))
  return picked.notes ? { ...seg, warnings: [...seg.warnings, ...picked.notes] } : seg
}
