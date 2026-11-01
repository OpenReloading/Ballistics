/**
 * Research evaluation of the bullet photo tool on catalogue bullets (research log:
 * `apps/docs/docs/research/bullet-photo-catalogue-geometry.md`). Bullet records with a length are
 * drawn, rendered as photographs of several kinds (own photograph beside a ruler, product-style
 * images of 1000, 500 and 250 px without a ruler, JPEG, a drop shadow, a tilt), measured with the
 * same steps as the tool's worker and compared with the drawing they were rendered from.
 *
 * Opt-in, it takes minutes: `BULLET_PHOTO_EVAL=<out.json> npx vitest run test/bullet-photo-catalogue.test.ts`
 * in `apps/web`, optionally with `BULLET_PHOTO_SCENARIO=<letter>` and `BULLET_PHOTO_PER_MAKER=<n>`.
 * It writes the summary per scenario and one row per photograph.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import {
  type BulletDimensions,
  bulletDimensions,
  bulletOutline,
  revolutionVolume,
} from '@open-reloading/drawing/bullet'
import sharp from 'sharp'
import { describe, it } from 'vitest'
import { scaleOf } from '../src/lib/bullet-photo.ts'
import { segmentPhoto } from '../src/lib/bullet-photo-colour.ts'
import { type BulletMeasurement, measureOutline } from '../src/lib/bullet-photo-measure.ts'
import { fitOutline } from '../src/lib/bullet-photo-outline.ts'
import { outlineHints } from '../src/lib/bullet-photo-quality.ts'
import { type PhotoSpec, renderPhoto } from '../src/lib/bullet-photo-sample.ts'
import { type Known, resolveScale } from '../src/lib/bullet-photo-scale.ts'

const out = process.env.BULLET_PHOTO_EVAL
const perMaker = Number(process.env.BULLET_PHOTO_PER_MAKER ?? 6)
const records = new URL('../../../packages/data/records/bullets/', import.meta.url)

interface Truth {
  id: string
  maker: string
  dims: BulletDimensions
}

/** Every `perMaker`-th record with a length of each maker, evenly spread over its files, and three boat tails of the photo tests. */
function sample(): Truth[] {
  const by = new Map<string, Truth[]>()
  for (const f of readdirSync(records).sort()) {
    const r = JSON.parse(readFileSync(new URL(f, records), 'utf8'))
    const given = bulletDimensions(r)
    if (!given) continue
    // a record with a boat-tail length and no base type is drawn as a boat tail
    const dims: BulletDimensions =
      given.base?.length && !given.base.type
        ? { ...given, base: { ...given.base, type: 'boat-tail' } }
        : given
    if ('reason' in bulletOutline(dims)) continue
    by.set(r.manufacturer, [
      ...(by.get(r.manufacturer) ?? []),
      { id: r.id, maker: r.manufacturer, dims },
    ])
  }
  const picked = [...by.values()].flatMap((list) => {
    const step = Math.max(1, Math.floor(list.length / perMaker))
    return list.filter((_, i) => i % step === 0).slice(0, perMaker)
  })
  const t: BulletDimensions = {
    diameter: 7.82,
    length: 30,
    noseLength: 17.5,
    meplatDiameter: 0.5,
    ogive: { form: 'tangent', radiusRatio: 1 },
  }
  return [
    ...picked,
    {
      maker: 'test',
      id: 'tangent-bt',
      dims: { ...t, base: { type: 'boat-tail', length: 5.5, angle: 7 } },
    },
    {
      maker: 'test',
      id: 'secant-bt',
      dims: {
        ...t,
        ogive: { form: 'secant', radiusRatio: 0.75 },
        base: { type: 'boat-tail', length: 6, angle: 8 },
      },
    },
    {
      maker: 'test',
      id: 'secant-bt-224',
      dims: {
        diameter: 5.7,
        length: 24.9,
        noseLength: 14.5,
        meplatDiameter: 0.5,
        ogive: { form: 'secant', radiusRatio: 0.6 },
        base: { type: 'boat-tail', length: 3.6, angle: 8 },
      },
    },
  ]
}

type Points = readonly (readonly [number, number])[]

/** Boat-tail length of a half profile: where it first reaches the shank radius `a`; 0 for a flat base. */
function tailOf(points: Points, a: number): number {
  const base = points.find(([r, z]) => z === 0 && r > 0)?.[0] ?? a
  if (base > 0.97 * a) return 0
  return points.find(([r]) => r >= a - 1e-6)?.[1] ?? 0
}

interface Scenario {
  name: string
  /** Scale of an own photograph, px per mm; else the bullet's length in px. */
  pxPerMm?: number
  lengthPx?: number
  ruler: boolean
  /** What gives the scale besides a ruler: the record's diameter, and the maker's length. */
  known: 'none' | 'diameter' | 'diameter+length'
  shadow?: boolean
  /** Bullet turned towards the camera by this many degrees (its silhouette foreshortened). */
  tilt?: number
  jpeg?: number
}

const product = { ruler: false, known: 'diameter' } as const
const scenarios: Scenario[] = [
  { name: 'A own photo, ruler, 24 px/mm', pxPerMm: 24, ruler: true, known: 'none' },
  { name: 'B product 1000 px, scale from diameter', lengthPx: 900, ...product },
  { name: 'C product 500 px, scale from diameter', lengthPx: 450, ...product },
  { name: 'D product 250 px, scale from diameter', lengthPx: 225, ...product },
  { name: 'E product 500 px, JPEG quality 70', lengthPx: 450, ...product, jpeg: 70 },
  { name: 'F product 500 px, drop shadow', lengthPx: 450, ...product, shadow: true },
  {
    name: 'G product 500 px, scale from diameter and maker length',
    lengthPx: 450,
    ...product,
    known: 'diameter+length',
  },
  { name: 'H product 500 px, tilted 10 degrees', lengthPx: 450, ...product, tilt: 10 },
]

/** The silhouette of the bullet turned `deg` towards the camera: its axial lengths times cos(deg), the nose redrawn tangent. */
function foreshortened(d: BulletDimensions, deg: number): BulletDimensions {
  const c = Math.cos((deg * Math.PI) / 180)
  const o = bulletOutline(d)
  if ('reason' in o) throw new Error(o.reason)
  const tail = tailOf(o.points, d.diameter / 2)
  const { bearingLength: _b, baseToOgive: _o, ...rest } = d
  return {
    ...rest,
    length: d.length * c,
    noseLength: o.noseLength * c,
    base: tail > 0 ? { type: 'boat-tail', length: tail * c } : { type: 'flat' },
    ogive: { form: 'tangent', radiusRatio: 1 },
  }
}

/** The bullet drawing the measured values give, as the designer would draw it. */
function drawn(m: BulletMeasurement): BulletDimensions | undefined {
  const v = (k: keyof BulletMeasurement['values']) => m.values[k]?.value
  const [diameter, length, nose, tail] = [
    v('diameter'),
    v('length'),
    v('noseLength'),
    v('base.length'),
  ]
  if (!diameter || !length) return
  const radius = v('ogive.radius')
  return {
    diameter,
    length,
    meplatDiameter: v('meplatDiameter') ?? 0,
    ...(nose && { noseLength: nose }),
    ...(m.baseType === 'boat-tail' && tail && { base: { type: 'boat-tail', length: tail } }),
    ...(m.ogiveForm === 'tangent' && { ogive: { form: 'tangent', radiusRatio: 1 } }),
    ...(m.ogiveForm === 'secant' && radius && { ogive: { form: 'secant', radius } }),
  }
}

/** The image after a JPEG round trip at `quality`. */
async function jpegged(
  image: { width: number; height: number; data: Uint8ClampedArray },
  quality: number,
) {
  const { width, height } = image
  const raw = { raw: { width, height, channels: 4 as const } }
  const jpg = await sharp(Buffer.from(image.data.buffer), raw).jpeg({ quality }).toBuffer()
  const back = await sharp(jpg).ensureAlpha().raw().toBuffer()
  return { width, height, data: new Uint8ClampedArray(back) }
}

/** The photograph of a bullet in scenario `s`: the bullet 3 degrees off level, the ruler below it in an own photograph. */
function specOf(s: Scenario, t: BulletDimensions, seed: number): PhotoSpec {
  const a = t.diameter / 2
  const k = s.pxPerMm ?? (s.lengthPx ?? 450) / t.length
  const lengthPx = t.length * k
  const margin = Math.max(60, 0.15 * lengthPx)
  const drop = lengthPx * Math.sin((3 * Math.PI) / 180)
  const top = s.ruler ? 120 + a * k : margin + a * k
  const height = Math.ceil(top + a * k + drop + (s.ruler ? 240 : margin))
  const own = s.ruler
  return {
    shape: s.tilt ? foreshortened(t, s.tilt) : t,
    pxPerMm: k,
    width: Math.ceil(Math.max(lengthPx + 2 * margin, own ? 45 * k + 80 : 0)),
    height,
    base: { x: margin, y: top },
    angle: (3 * Math.PI) / 180,
    paper: 235,
    bullet: 115,
    gradient: 10,
    shading: own ? 20 : 30,
    noise: own ? 2 : 3,
    blur: own ? 0.6 : 1,
    ruler: own ? { x0: 30, y: height - 80, heightPx: 70, lengthMm: 45, toEdges: true } : undefined,
    seed,
    shadow: s.shadow
      ? { dx: 0.02 * lengthPx, dy: 0.03 * lengthPx, blur: 0.02 * lengthPx, depth: 0.2 }
      : undefined,
  }
}

const knownOf = (s: Scenario, t: BulletDimensions): Known =>
  s.known === 'none'
    ? {}
    : s.known === 'diameter'
      ? { diameter: t.diameter }
      : { diameter: t.diameter, length: t.length }

/** The tool's steps on the photograph: cut-out, outline, quality, scale, measurement; or why it stops. */
async function measured(s: Scenario, t: BulletDimensions, seed: number) {
  const photo = renderPhoto(specOf(s, t, seed))
  const image = s.jpeg ? await jpegged(photo.image, s.jpeg) : photo.image
  const seg = segmentPhoto(image, photo.span ? [photo.span.a, photo.span.b] : [])
  const outline = fitOutline(seg, { edgeSpread: seg.edgeSpread })
  if (!outline) return 'no outline' as const
  const { hints, unusable } = outlineHints(outline)
  if (unusable) return 'unusable' as const
  const unit = measureOutline(outline, { pxPerMm: 1, relUncertainty: 0 })
  const { scale, notes } = resolveScale(unit, photo.span && scaleOf([photo.span]), knownOf(s, t))
  if (!scale) return 'no scale' as const
  return {
    m: measureOutline(outline, scale),
    warnings: seg.warnings.length + hints.length + notes.length,
  }
}

interface Errors {
  warnings: number
  length: number
  errLength: number
  uLength: number
  errDiameter: number
  errLD: number
  nose: number
  errNose: number
  tail: number
  errTail: number
  errVolume: number
  errSeated: number
}

/** The measurement's errors against the drawing `t`: lengths in mm, ratios and volumes relative. */
function errorsOf(t: BulletDimensions, m: BulletMeasurement, warnings: number): Errors | undefined {
  const truth = bulletOutline(t)
  if ('reason' in truth) return
  const nan = Number.NaN
  const [L, D, nose] = [m.values.length, m.values.diameter, m.values.noseLength]
  const tail = tailOf(truth.points, t.diameter / 2)
  const d = drawn(m)
  const o = d && bulletOutline(d, 'entered')
  const shape = o && !('reason' in o) ? o : undefined
  // seated at a fixed COAL: one calibre deep, half the length for a bullet under 2.5 calibres
  const depth = t.length / t.diameter < 2.5 ? 0.5 * t.length : t.diameter
  const seated = revolutionVolume(truth.points, depth)
  const errLength = L ? L.value - t.length : nan
  return {
    warnings,
    length: t.length,
    errLength,
    uLength: L?.uncertainty ?? nan,
    errDiameter: D ? D.value - t.diameter : nan,
    errLD: L && D ? L.value / D.value / (t.length / t.diameter) - 1 : nan,
    nose: truth.noseLength,
    errNose: nose ? nose.value - truth.noseLength : nan,
    tail,
    errTail: (m.baseType === 'boat-tail' ? (m.values['base.length']?.value ?? 0) : 0) - tail,
    errVolume: shape ? shape.volume / truth.volume - 1 : nan,
    errSeated: shape
      ? revolutionVolume(shape.points, Math.max(0, depth + errLength)) / seated - 1
      : nan,
  }
}

interface Row extends Partial<Errors> {
  scenario: string
  id: string
  maker: string
  diameterPx: number
  status: 'measured' | 'no outline' | 'unusable' | 'no scale'
}

async function evaluate(s: Scenario, b: Truth, seed: number): Promise<Row | undefined> {
  const k = s.pxPerMm ?? (s.lengthPx ?? 450) / b.dims.length
  const row = { scenario: s.name, id: b.id, maker: b.maker, diameterPx: b.dims.diameter * k }
  const r = await measured(s, b.dims, seed)
  if (typeof r === 'string') return { ...row, status: r }
  const e = errorsOf(b.dims, r.m, r.warnings)
  return e && { ...row, status: 'measured', ...e }
}

const quantile = (xs: number[], q: number) => {
  const a = xs.filter(Number.isFinite).sort((p, r) => p - r)
  return a[Math.min(a.length - 1, Math.round(q * (a.length - 1)))] ?? Number.NaN
}

/** Median and P90 of the absolute errors of the measured photographs of one scenario. */
function summary(rows: Row[]) {
  const ms = rows.flatMap((r) => (r.status === 'measured' ? [r as Row & Errors] : []))
  const abs = (f: (r: Row & Errors) => number) => {
    const xs = ms.map(f).map(Math.abs)
    return `${quantile(xs, 0.5).toPrecision(2)} / ${quantile(xs, 0.9).toPrecision(2)}`
  }
  return {
    photos: rows.length,
    measured: ms.length,
    'length % (median / P90 of |error|)': abs((r) => (100 * r.errLength) / r.length),
    'length mm': abs((r) => r.errLength),
    'L/D %': abs((r) => 100 * r.errLD),
    'nose length %': abs((r) => (100 * r.errNose) / r.nose),
    'boat tail mm (true tails)': abs((r) => (r.tail > 0 ? r.errTail : Number.NaN)),
    'false boat tails': `${ms.filter((r) => r.tail === 0 && r.errTail > 0).length} of ${ms.filter((r) => r.tail === 0).length}`,
    'volume %': abs((r) => 100 * r.errVolume),
    'seated volume %': abs((r) => 100 * r.errSeated),
    'length within 3 u': ms.filter((r) => Math.abs(r.errLength) <= 3 * r.uLength).length,
    'with a warning': ms.filter((r) => r.warnings > 0).length,
  }
}

describe.skipIf(!out)('bullet photo on catalogue bullets (research evaluation)', () => {
  it('measures every scenario', { timeout: 3_600_000 }, async () => {
    const bullets = sample()
    const only = process.env.BULLET_PHOTO_SCENARIO
    const rows: Row[] = []
    for (const s of scenarios.filter((x) => !only || x.name.startsWith(only)))
      for (const [i, b] of bullets.entries()) {
        const r = await evaluate(s, b, 11 + i)
        if (r) rows.push(r)
      }
    const names = [...new Set(rows.map((r) => r.scenario))]
    const summaries = Object.fromEntries(
      names.map((n) => [n, summary(rows.filter((r) => r.scenario === n))]),
    )
    writeFileSync(out as string, JSON.stringify({ summaries, rows }, null, 1))
  })
})
