/**
 * The dimensions of a bullet from its outline in a photograph, each with a standard uncertainty
 * (`apps/docs/docs/models/bullet-photo.md`): the shank from the widest parallel run, the boat tail
 * from a line, the nose from a circle (tangent or secant), the cannelure from a dip of the shank.
 * Pure: no React, DOM or Next.js, so it can run in a Web Worker.
 */
import { fromSi } from '@open-reloading/schema'
import { msg } from '../i18n/translate.ts'
import { type Scale, solve } from './bullet-photo.ts'
import { edgeUncertainty, type Outline } from './bullet-photo-outline.ts'
import { median1 } from './raster-ops.ts'
import type { Wording } from './wording.ts'

// Unchecked reads inside loops whose bounds keep the index in range; module-local so the calls inline.
const at = (a: ArrayLike<number>, i: number) => a[i] as number

/** A value with its standard uncertainty, in the unit of its field: mm, degrees or a ratio. */
export interface Measured {
  value: number
  uncertainty: number
}

/** The designer's record paths of the values a photograph gives. */
export const photoFields = [
  'length',
  'diameter',
  'bearingLength',
  'noseLength',
  'meplatDiameter',
  'ogive.radius',
  'ogive.radiusRatio',
  'base.length',
  'base.diameter',
  'base.angle',
  'cannelure.start',
  'cannelure.width',
  'cannelure.depth',
] as const

export type PhotoField = (typeof photoFields)[number]

/** What a photograph gave: the values, the forms found and what could not be told. */
export interface BulletMeasurement {
  values: Partial<Record<PhotoField, Measured>>
  /** The nose form the circle fit tells, absent when the nose is neither. */
  ogiveForm?: 'tangent' | 'secant'
  baseType: 'flat' | 'boat-tail'
  /** Sentences about what is missing or doubtful. */
  notes: Wording[]
}

/** Standard uncertainty of where a pointed tip ends along the axis, px. */
const tipUncertainty = 1

interface Cov {
  /** Row-major covariance of the parameters. */
  c: number[]
  n: number
}

/** The first-order uncertainty of `f(p)` (GUM 5.1.2): the numeric gradient with the covariance of the parameters. */
function propagate(f: (p: number[]) => number, p: number[], cov: Cov): number {
  const g = p.map((v, i) => {
    const h = 1e-4 * (Math.abs(v) + 1)
    const [up, dn] = [[...p], [...p]]
    up[i] = v + h
    dn[i] = v - h
    return (f(up) - f(dn)) / (2 * h)
  })
  let s = 0
  for (let i = 0; i < cov.n; i++)
    for (let j = 0; j < cov.n; j++) s += at(g, i) * at(g, j) * at(cov.c, i * cov.n + j)
  return Math.sqrt(Math.max(s, 0))
}

/** A block diagonal covariance from the covariances and variances of independent parts. */
function blocks(parts: Cov[]): Cov {
  const n = parts.reduce((a, p) => a + p.n, 0)
  const c = new Array<number>(n * n).fill(0)
  let off = 0
  for (const p of parts) {
    for (let i = 0; i < p.n; i++)
      for (let j = 0; j < p.n; j++) c[(off + i) * n + off + j] = at(p.c, i * p.n + j)
    off += p.n
  }
  return { c, n }
}

const variance = (u: number): Cov => ({ c: [u * u], n: 1 })

/** Inverse of the `n` x `n` matrix `m`; undefined when singular. */
function inverse(m: number[], n: number): number[] | undefined {
  const out = new Array<number>(n * n)
  for (let j = 0; j < n; j++) {
    const col = solve(
      m,
      Array.from({ length: n }, (_, i) => (i === j ? 1 : 0)),
      n,
    )
    if (!col) return
    for (let i = 0; i < n; i++) out[i * n + j] = at(col, i)
  }
  return out
}

interface Lsq {
  p: number[]
  rss: number
  cov: Cov
  /** Residual standard deviation, px, floored at the edge uncertainty. */
  sigma: number
}

/**
 * Levenberg-Marquardt least squares of `n` residuals. `row(p, i)` gives the residual and its
 * gradient. The covariance is sigma^2 (J'J)^-1 with sigma the residual rms, not below the edge
 * uncertainty.
 */
function lsq(
  p0: number[],
  n: number,
  row: (p: number[], i: number) => [number, number[]],
): Lsq | undefined {
  const m = p0.length
  const pass = (p: number[]) => {
    const jtj = new Array<number>(m * m).fill(0)
    const jtr = new Array<number>(m).fill(0)
    let rss = 0
    for (let i = 0; i < n; i++) {
      const [r, g] = row(p, i)
      rss += r * r
      for (let a = 0; a < m; a++) {
        jtr[a] = at(jtr, a) + at(g, a) * r
        for (let b = 0; b < m; b++) jtj[a * m + b] = at(jtj, a * m + b) + at(g, a) * at(g, b)
      }
    }
    return { jtj, jtr, rss }
  }
  let p = p0
  let cur = pass(p)
  let lambda = 1e-3
  for (let it = 0; it < 80; it++) {
    const damped = cur.jtj.map((v, k) => (k % (m + 1) === 0 ? v * (1 + lambda) + 1e-12 : v))
    const step = solve(
      damped,
      cur.jtr.map((v) => -v),
      m,
    )
    if (!step) return
    const next = p.map((v, i) => v + at(step, i))
    const tried = pass(next)
    if (tried.rss < cur.rss) {
      const gain = cur.rss - tried.rss
      p = next
      cur = tried
      lambda = Math.max(lambda / 10, 1e-9)
      if (gain < 1e-12 * (1 + cur.rss)) break
    } else {
      lambda *= 10
      if (lambda > 1e9) break
    }
  }
  const inv = inverse(cur.jtj, m)
  if (!inv) return
  const sigma = Math.max(Math.sqrt(cur.rss / Math.max(n - m, 1)), edgeUncertainty)
  return { p, rss: cur.rss, cov: { c: inv.map((v) => v * sigma * sigma), n: m }, sigma }
}

/** The line y = a + b x through the points, with its covariance. */
function line(xs: number[], ys: number[]): Lsq | undefined {
  return lsq([0, 0], xs.length, (p, i) => [
    at(p, 0) + at(p, 1) * at(xs, i) - at(ys, i),
    [1, at(xs, i)],
  ])
}

/** The points (z, r) the circle fits are the nose's: a circle in the (r, z) plane, centre (rc, zc). */
interface Pt {
  z: number
  r: number
}

/**
 * The circle through the nose points by minimising the distance of each point to it (geometric
 * fit, Coope 1993; the algebraic fit of Kasa 1976 starts it). `tangent` keeps the circle tangent to
 * the shank of radius `a`: its centre then lies at `a - rho` from the axis. Parameters: `[rc, zc,
 * rho]`, or `[zc, rho]` when tangent.
 */
function circle(pts: Pt[], a: number, tangent: boolean): Lsq | undefined {
  const zm = pts.reduce((s, q) => s + q.z, 0) / pts.length
  const q = pts.map((p) => ({ z: p.z - zm, r: p.r }))
  // algebraic start: r^2 + z^2 = A r + B z + C
  const m = new Array<number>(9).fill(0)
  const b = [0, 0, 0]
  for (const p of q) {
    const row = [p.r, p.z, 1]
    const y = p.r * p.r + p.z * p.z
    for (let i = 0; i < 3; i++) {
      b[i] = at(b, i) + at(row, i) * y
      for (let j = 0; j < 3; j++) m[i * 3 + j] = at(m, i * 3 + j) + at(row, i) * at(row, j)
    }
  }
  const k = solve(m, b, 3)
  if (!k) return
  const [rc0, zc0] = [at(k, 0) / 2, at(k, 1) / 2]
  const rho0 = Math.sqrt(Math.max(at(k, 2) + rc0 * rc0 + zc0 * zc0, 1e-6))
  const fit = tangent
    ? lsq([zc0, rho0], q.length, (p, i) => {
        const pt = q[i] as Pt
        const [zc, rho] = [at(p, 0), at(p, 1)]
        const [dr, dz] = [pt.r - (a - rho), pt.z - zc]
        const d = Math.max(Math.hypot(dr, dz), 1e-9)
        return [d - rho, [-dz / d, dr / d - 1]]
      })
    : lsq([rc0, zc0, rho0], q.length, (p, i) => {
        const pt = q[i] as Pt
        const [dr, dz] = [pt.r - at(p, 0), pt.z - at(p, 1)]
        const d = Math.max(Math.hypot(dr, dz), 1e-9)
        return [d - at(p, 2), [-dr / d, -dz / d, -1]]
      })
  if (!fit) return
  fit.p[tangent ? 0 : 1] = at(fit.p, tangent ? 0 : 1) + zm
  return fit
}

/** The nose from the circle parameters, the shank radius `a` and the tip `zt`; `zRough` picks the root of a secant. */
function noseOf(p: number[], tangent: boolean, zRough: number) {
  const [rc, zc, rho, a, zt] = tangent
    ? [at(p, 2) - at(p, 1), at(p, 0), at(p, 1), at(p, 2), at(p, 3)]
    : [at(p, 0), at(p, 1), at(p, 2), at(p, 3), at(p, 4)]
  const dz = Math.sqrt(Math.max(rho * rho - (a - rc) ** 2, 0))
  const zj = tangent
    ? zc
    : Math.abs(zc - dz - zRough) < Math.abs(zc + dz - zRough)
      ? zc - dz
      : zc + dz
  const m = Math.max(0, rc + Math.sqrt(Math.max(rho * rho - (zt - zc) ** 2, 0)))
  const [n, k] = [zt - zj, a - m]
  return { rc, zc, rho, zj, m, n, k, ratio: (n * n + k * k) / (2 * k * rho) }
}

/**
 * The secant circle when it fits the points better than the tangent one by more than the edge
 * noise explains (likelihood ratio above 9, three standard deviations); else the tangent circle.
 */
function chooseNose(free: Lsq, tang: Lsq, count: number) {
  const sigma2 = Math.max(free.rss / Math.max(count - 3, 1), edgeUncertainty ** 2)
  return (tang.rss - free.rss) / sigma2 > 9
    ? { fit: free, tangent: false }
    : { fit: tang, tangent: true }
}

/** The shank: its radius, the scatter of its edges and the first and last sample near the full width. */
interface Shank {
  rRef: number
  sigma: number
  /** Standard uncertainty of the radius, px. */
  u: number
  first: number
  last: number
}

export function shankOf(o: Outline): Shank {
  const rs = o.r.map((_, i) => median1(o.r.slice(Math.max(0, i - 2), i + 3)))
  const rMax = Math.max(...rs)
  const tol = Math.max(1, 0.01 * rMax)
  const on = rs.flatMap((v, i) => (v >= rMax - tol ? [i] : []))
  const rRef = median1(on.map((i) => at(o.r, i)))
  const sigma = 1.4826 * median1(on.map((i) => Math.abs(at(o.r, i) - rRef)))
  // each edge carries the edge uncertainty, so the radius half of it, and the scatter averages over the run
  const u = Math.sqrt(0.5 * edgeUncertainty ** 2 + sigma ** 2 / Math.max(1, on.length / 4))
  return { rRef, sigma, u, first: at(on, 0), last: at(on, on.length - 1) }
}

type Put = (key: PhotoField, px: number, uPx: number) => void

/** The boat tail, if there is one: where its cone ends on the shank and that position's uncertainty, px. */
function boatTailOf(o: Outline, s: Shank, put: Put, m: BulletMeasurement) {
  const flat = { z: 0, u: 0 }
  const base = median1(o.r.slice(0, 5))
  const deficit = s.rRef - base
  if (deficit < Math.max(2.5, 0.04 * s.rRef) || s.first < 6) return flat
  // the middle of the cone, clear of the rounded corner at the base and of the one where it meets the shank
  const idx = o.r.flatMap((_, i) => (i >= 0.25 * s.first && i < 0.85 * s.first ? [i] : []))
  if (idx.length < 5) return flat
  const fit = line(
    idx.map((i) => at(o.z, i)),
    idx.map((i) => at(o.r, i)),
  )
  const [r0, k] = fit ? [at(fit.p, 0), at(fit.p, 1)] : [0, 0]
  if (!fit || k <= 0.02) return flat
  const cov = blocks([fit.cov, variance(s.u)])
  const end = (p: number[]) => (at(p, 2) - at(p, 0)) / at(p, 1)
  const u = propagate(end, [r0, k, s.rRef], cov)
  m.baseType = 'boat-tail'
  put('base.length', end([r0, k, s.rRef]), u)
  put('base.diameter', 2 * r0, 2 * Math.sqrt(at(fit.cov.c, 0)))
  m.values['base.angle'] = {
    value: fromSi('angle', Math.atan(k)),
    uncertainty: fromSi('angle', Math.sqrt(at(fit.cov.c, 3)) / (1 + k * k)),
  }
  if (fit.sigma > 1)
    m.notes.push(
      msg('The boat tail is not a straight cone in the photograph (a rebated boat tail?).'),
    )
  return { z: end([r0, k, s.rRef]), u }
}

/** The nose: its length from the junction with the shank to the tip, the meplat, the circle's radius and Rt/R. Returns where the nose starts and its uncertainty, and the tip. */
function noseFit(o: Outline, s: Shank, put: Put, m: BulletMeasurement) {
  const zRough = at(o.z, s.last)
  const pts: Pt[] = o.z.flatMap((z, i) =>
    i >= s.last && at(o.r, i) <= s.rRef - 1.5 && z <= o.length - 3 ? [{ z, r: at(o.r, i) }] : [],
  )
  const free = pts.length >= 12 ? circle(pts, s.rRef, false) : undefined
  const tang = pts.length >= 12 ? circle(pts, s.rRef, true) : undefined
  const model = free && tang ? chooseNose(free, tang, pts.length) : undefined
  if (!model || model.fit.sigma > 1.2) return
  const { fit, tangent } = model
  const [rho, zc] = tangent ? [at(fit.p, 1), at(fit.p, 0)] : [at(fit.p, 2), at(fit.p, 1)]
  const rc = tangent ? s.rRef - rho : at(fit.p, 0)
  // a pointed tip is thinner than a pixel at its end: the circle's end on the axis is the better tip
  const atAxis = zc + Math.sqrt(Math.max(rho * rho - rc * rc, 0))
  const sharp =
    median1(o.r.slice(-3)) < 1.5 && rho >= Math.abs(rc) && Math.abs(atAxis - o.length) <= 4
  const tip = sharp ? atAxis : o.length
  const tipU = sharp ? tipUncertainty : edgeUncertainty
  const p = [...fit.p, s.rRef, tip]
  const cov = blocks([fit.cov, variance(s.u), variance(tipU)])
  const geometry = (q: number[]) => noseOf(q, tangent, zRough)
  const of = (pick: (g: ReturnType<typeof noseOf>) => number) =>
    propagate((q) => pick(geometry(q)), p, cov)
  const now = geometry(p)
  if (!(now.n > 0 && now.k > 0)) return
  put(
    'noseLength',
    now.n,
    of((g) => g.n),
  )
  put(
    'meplatDiameter',
    2 * now.m,
    2 *
      Math.max(
        of((g) => g.m),
        0.5 * edgeUncertainty,
      ),
  )
  put(
    'ogive.radius',
    now.rho,
    of((g) => g.rho),
  )
  m.values['ogive.radiusRatio'] = { value: Math.min(now.ratio, 1), uncertainty: of((g) => g.ratio) }
  m.ogiveForm = tangent ? 'tangent' : 'secant'
  return { z: now.zj, u: of((g) => g.zj), tip, tipU }
}

/** The widest dip of the shank, as a cannelure. */
function cannelureOf(o: Outline, s: Shank, put: Put) {
  const tol = Math.max(2, 4 * s.sigma)
  let run: [number, number] | undefined
  let area = 0
  let i = s.first
  while (i <= s.last) {
    if (at(o.r, i) >= s.rRef - tol) {
      i++
      continue
    }
    let j = i
    let a = 0
    while (j <= s.last && at(o.r, j) < s.rRef - tol) a += s.rRef - at(o.r, j++)
    if (a > area) [run, area] = [[i, j - 1], a]
    i = j
  }
  if (!run || run[1] - run[0] + 1 < 3) return
  const [a, b] = run
  const edge = Math.hypot(edgeUncertainty, 0.5)
  put('cannelure.start', at(o.z, a) - 0.5, edge)
  put('cannelure.width', at(o.z, b) - at(o.z, a) + 1, edge)
  put(
    'cannelure.depth',
    s.rRef - median1(o.r.slice(a, b + 1)),
    Math.hypot(edgeUncertainty, s.sigma),
  )
}

/**
 * The dimensions in the outline `o` at `scale`: the length from the two ends on the axis; the
 * diameter from the widest parallel run; the boat tail from a line through the cone; the nose from
 * a circle fitted to the edge past the shank, tangent or secant; the cannelure from a dip of the
 * shank. A value that cannot be told is left out and `notes` says why. Uncertainties combine the
 * edge uncertainty and the fit's covariance first-order, then the scale's relative uncertainty.
 */
export function measureOutline(o: Outline, scale: Scale): BulletMeasurement {
  const m: BulletMeasurement = { values: {}, baseType: 'flat', notes: [] }
  if (o.z.length < 20) {
    m.notes.push(msg('The bullet is too short in the photograph to measure.'))
    return m
  }
  // a spread edge adds its position's uncertainty to every length, twice over for a width
  const extra = Math.sqrt(Math.max(0, o.edge ** 2 - edgeUncertainty ** 2))
  const put: Put = (key, px, uPx) => {
    const value = px / scale.pxPerMm
    const widths = key === 'diameter' || key === 'meplatDiameter' || key === 'base.diameter'
    m.values[key] = {
      value,
      uncertainty: Math.hypot(
        Math.hypot(uPx, (widths ? 2 : 1) * extra) / scale.pxPerMm,
        value * scale.relUncertainty,
      ),
    }
  }
  const s = shankOf(o)
  put('diameter', 2 * s.rRef, 2 * s.u)
  const bt = boatTailOf(o, s, put, m)
  const nose = noseFit(o, s, put, m)
  const [tip, tipU] = nose ? [nose.tip, nose.tipU] : [o.length, edgeUncertainty]
  put('length', tip, Math.hypot(edgeUncertainty, tipU))
  if (nose) {
    put('bearingLength', nose.z - bt.z, Math.hypot(nose.u, bt.u))
    m.notes.push(
      m.ogiveForm === 'tangent'
        ? msg('The nose is a tangent ogive: its circle touches the shank.')
        : msg('The nose is a secant ogive: its circle cuts the shank at an angle.'),
    )
  } else {
    // no circle: the nose starts between where the shank leaves 3 px and 0.5 px of the full width
    const [z1, z2] = [
      at(
        o.z,
        o.r.findLastIndex((v) => v >= s.rRef - 0.5),
      ),
      at(
        o.z,
        o.r.findLastIndex((v) => v >= s.rRef - 3),
      ),
    ]
    const half = (z2 - z1) / (2 * Math.sqrt(3))
    const start = (z1 + z2) / 2
    put('noseLength', tip - start, Math.hypot(half, tipU))
    put('bearingLength', start - bt.z, Math.hypot(half, bt.u))
    put('meplatDiameter', 2 * median1(o.r.slice(-3)), 2 * edgeUncertainty)
    m.notes.push(
      msg(
        'The nose is not a circle arc (a hybrid or another form): no ogive radius or Rt/R is given, and the nose length is where the shank ends, within a range.',
      ),
    )
  }
  cannelureOf(o, s, put)
  return m
}
