/**
 * Shot-group statistics, `apps/docs/docs/models/groups.md`: size and dispersion measures of one group,
 * chi-square confidence intervals by shot count, pooling of groups of one load in angle, the
 * dispersion and prediction ellipses for a stated coverage and the exact angle of a length at a
 * distance. SI in and out:
 * target-plane coordinates m (x right, y up), distance m, velocity m/s, angles rad. A value whose
 * minimum shot count is not met is `undefined`.
 */
import { bisect } from '../bisect.ts'
import { need, nth } from '../errors.ts'
import { chiSquareQuantile } from './chi-square.ts'
import { fQuantileTwoNumeratorDegrees } from './f-distribution.ts'

/** One shot in the target plane, m (x right, y up); `velocity` m/s. */
export interface GroupShot {
  x: number
  y: number
  excluded?: boolean
  velocity?: number
}

/** A point in the target plane, m (x right, y up). */
export interface GroupPoint {
  x: number
  y: number
}

/** Input of the group statistics: shots at one distance, finite coordinates, `distance` > 0. */
export interface GroupInput {
  /** Shots of the group; excluded shots are left out of the dispersion values. */
  shots: GroupShot[]
  /** Muzzle to target, m. */
  distance: number
  /** Point of aim, m. */
  aim?: GroupPoint
  /** Two-sided level of the intervals in `confidence`, in (0, 1); default 0.95. */
  confidenceLevel?: number
}

/** Two-sided confidence interval. */
export interface Interval {
  /** Lower limit, in the unit of the estimate. */
  lower: number
  /** Upper limit, in the unit of the estimate. */
  upper: number
}

/**
 * Chi-square intervals (`apps/docs/docs/models/groups.md`, "Confidence intervals by shot count"):
 * `standardDeviationX`, `standardDeviationY` with `axisDegreesOfFreedom` (n - 1); the circular
 * `sigma` (per-axis SD of a circular normal population), `radialStandardDeviation` (sqrt 2 sigma) and `cep`
 * (sqrt(2 ln 2) sigma) with `circularDegreesOfFreedom` (2 (n - 1)), valid for equal, uncorrelated axes.
 */
export interface GroupConfidence {
  confidenceLevel: number
  axisDegreesOfFreedom: number
  circularDegreesOfFreedom: number
  standardDeviationX: Interval
  standardDeviationY: Interval
  sigma: Interval
  radialStandardDeviation: Interval
  cep: Interval
}

/** Sample covariance, m2, divisor n - 1. */
export interface GroupCovariance {
  xx: number
  xy: number
  yy: number
}

/** Direction of the group centre from the point of aim, N up; `centre` when they coincide. */
export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'centre'

/** Group centre minus point of aim, m; `compass` with N up, `centre` below 1e-9 m. */
export interface AimOffset {
  /** Horizontal offset, m, x right. */
  dx: number
  /** Vertical offset, m, y up. */
  dy: number
  /** Length of the offset, m. */
  distance: number
  /** Direction of the offset. */
  compass: CompassPoint
}

/** Vertical position against velocity over `shotCount` shots: `correlation`, least-squares `slope` m per m/s. */
export interface VelocityCorrelation {
  /** Included shots with a velocity, at least 3. */
  shotCount: number
  /** Pearson correlation of vertical position and velocity, -1 to 1. */
  correlation: number
  /** Least-squares slope of vertical position over velocity, m per m/s. */
  slope: number
}

/**
 * Values of one group, m unless stated; definitions, divisors and sources in
 * `apps/docs/docs/models/groups.md`. Dispersion values need n >= 2.
 */
export interface GroupStatistics {
  /** Included shots. */
  shotCount: number
  /** Shots marked excluded. */
  excludedCount: number
  /** Mean position of the included shots. */
  centre?: GroupPoint
  /** Largest distance between two shots, centre to centre. */
  extremeSpread?: number
  /** Smallest distance between two shots, centre to centre; descriptive, no interval. */
  minPairDistance?: number
  /** Mean distance over all pairs of shots; descriptive, no interval. */
  meanPairDistance?: number
  /** Horizontal extent of the shot centres. */
  width?: number
  /** Vertical extent of the shot centres. */
  height?: number
  /** Mean distance of the shots from the centre. */
  meanRadius?: number
  /** Horizontal SD, divisor n - 1. */
  standardDeviationX?: number
  /** Vertical SD, divisor n - 1. */
  standardDeviationY?: number
  /** sqrt(standardDeviationX^2 + standardDeviationY^2), divisor n - 1. */
  radialStandardDeviation?: number
  /** SD of the distances of the shots from the centre, divisor n - 1. */
  radiusStandardDeviation?: number
  /** Circular-normal estimate sqrt(2 ln 2) sqrt((standardDeviationX^2 + standardDeviationY^2) / 2); `confidence.cep` is its interval. */
  cep?: number
  /** Radius about the centre holding half of the bivariate normal with the sample covariance; unequal or correlated axes allowed, no interval. */
  cepElliptical?: number
  /** Sample covariance of the shot positions. */
  covariance?: GroupCovariance
  /** Major axis of the covariance, rad from +x counterclockwise, in (-pi/2, pi/2]; `undefined` for equal variances without covariance. */
  principalAxisAngle?: number
  /** Centre of the excluded shots minus the group centre. */
  excludedOffset?: GroupPoint
  /** Group centre minus point of aim; present when the input gives an aim. */
  aimOffset?: AimOffset
  /** Present with at least 3 included shots with a velocity that vary in both position and velocity. */
  velocityCorrelation?: VelocityCorrelation
  /** Chi-square intervals at the confidence level of the input. */
  confidence?: GroupConfidence
}

/** Pooled dispersion values, m for lengths or rad for angles (`apps/docs/docs/models/groups.md`, "Angles and pooling"). */
export interface PooledValues {
  standardDeviationX: number
  standardDeviationY: number
  radialStandardDeviation: number
  cep: number
  /** Average of the groups' extreme spreads. */
  meanExtremeSpread: number
  confidence: GroupConfidence
}

/**
 * Pooled values of several groups of one load, each group about its own centre, pooled in angle
 * (`apps/docs/docs/models/groups.md`, "Angles and pooling"). The length fields, m, are set only when every
 * pooled group has the same distance.
 */
export interface PooledGroupStatistics extends Partial<PooledValues> {
  /** Groups with at least 2 shots, the ones pooled. */
  groupCount: number
  /** Shots in the pooled groups. */
  shotCount: number
  groupSizes: number[]
  /** The same values in angle, rad: each group's lengths over its own distance. */
  angular?: PooledValues
}

const cepFactor = Math.sqrt(2 * Math.LN2)
const compassPoints: CompassPoint[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length

function centreOf(points: GroupPoint[]): GroupPoint {
  return { x: mean(points.map((p) => p.x)), y: mean(points.map((p) => p.y)) }
}

/** Sums of squares and products about the centre. */
function sums(points: GroupPoint[], c: GroupPoint) {
  let xx = 0
  let yy = 0
  let xy = 0
  for (const p of points) {
    xx += (p.x - c.x) ** 2
    yy += (p.y - c.y) ** 2
    xy += (p.x - c.x) * (p.y - c.y)
  }
  return { xx, yy, xy }
}

/** Largest, smallest and mean distance over all pairs; n >= 2. */
function pairDistances(points: GroupPoint[]) {
  let max = 0
  let min = Number.POSITIVE_INFINITY
  let sum = 0
  for (const [i, p] of points.entries())
    for (let j = i + 1; j < points.length; j++) {
      const q = nth(points, j)
      const d = Math.hypot(p.x - q.x, p.y - q.y)
      max = Math.max(max, d)
      min = Math.min(min, d)
      sum += d
    }
  return { max, min, mean: sum / ((points.length * (points.length - 1)) / 2) }
}

function confidenceOf(sxx: number, syy: number, df: number, level: number): GroupConfidence {
  const tail = (1 - level) / 2
  const sd = (s: number, nu: number): Interval => ({
    lower: Math.sqrt(s / chiSquareQuantile(1 - tail, nu)),
    upper: Math.sqrt(s / chiSquareQuantile(tail, nu)),
  })
  const scale = (i: Interval, f: number): Interval => ({ lower: f * i.lower, upper: f * i.upper })
  const sigma = sd(sxx + syy, 2 * df)
  return {
    confidenceLevel: level,
    axisDegreesOfFreedom: df,
    circularDegreesOfFreedom: 2 * df,
    standardDeviationX: sd(sxx, df),
    standardDeviationY: sd(syy, df),
    sigma,
    radialStandardDeviation: scale(sigma, Math.SQRT2),
    cep: scale(sigma, cepFactor),
  }
}

function checkLevel(level: number): void {
  need(level > 0 && level < 1, 'confidence level must lie in (0, 1)')
}

function checkInput(input: GroupInput): void {
  need(Number.isFinite(input.distance) && input.distance > 0, 'distance must be positive')
  for (const s of input.shots) {
    need(Number.isFinite(s.x) && Number.isFinite(s.y), 'shot coordinates must be finite')
    need(s.velocity === undefined || Number.isFinite(s.velocity), 'shot velocity must be finite')
  }
  if (input.aim)
    need(Number.isFinite(input.aim.x) && Number.isFinite(input.aim.y), 'aim must be finite')
}

function compassOf(dx: number, dy: number, distance: number): CompassPoint {
  if (distance < 1e-9) return 'centre'
  // bearing clockwise from up, 8 sectors of 45 degrees centred on N, NE, ...
  const bearing = Math.atan2(dx, dy)
  return nth(compassPoints, (Math.round(bearing / (Math.PI / 4)) + 8) % 8)
}

function velocityCorrelationOf(shots: GroupShot[]): VelocityCorrelation | undefined {
  const withV = shots.filter((s) => s.velocity !== undefined) as Required<
    Pick<GroupShot, 'y' | 'velocity'>
  >[]
  if (withV.length < 3) return undefined
  const v0 = mean(withV.map((s) => s.velocity))
  const y0 = mean(withV.map((s) => s.y))
  let vv = 0
  let yy = 0
  let vy = 0
  for (const s of withV) {
    vv += (s.velocity - v0) ** 2
    yy += (s.y - y0) ** 2
    vy += (s.velocity - v0) * (s.y - y0)
  }
  if (vv === 0 || yy === 0) return undefined
  return { shotCount: withV.length, correlation: vy / Math.sqrt(vv * yy), slope: vy / vv }
}

/** Statistics of one group, `apps/docs/docs/models/groups.md`. */
export function groupStatistics(input: GroupInput): GroupStatistics {
  checkInput(input)
  const level = input.confidenceLevel ?? 0.95
  checkLevel(level)
  const included = input.shots.filter((s) => !s.excluded)
  const excluded = input.shots.filter((s) => s.excluded)
  const n = included.length
  const out: GroupStatistics = { shotCount: n, excludedCount: excluded.length }
  if (n === 0) return out

  const c = centreOf(included)
  out.centre = c
  if (excluded.length > 0) {
    const e = centreOf(excluded)
    out.excludedOffset = { x: e.x - c.x, y: e.y - c.y }
  }
  if (input.aim) {
    const dx = c.x - input.aim.x
    const dy = c.y - input.aim.y
    const distance = Math.hypot(dx, dy)
    out.aimOffset = { dx, dy, distance, compass: compassOf(dx, dy, distance) }
  }
  const vc = velocityCorrelationOf(included)
  if (vc) out.velocityCorrelation = vc
  if (n < 2) return out

  const xs = included.map((s) => s.x)
  const ys = included.map((s) => s.y)
  const s = sums(included, c)
  const radii = included.map((p) => Math.hypot(p.x - c.x, p.y - c.y))
  const meanRadius = mean(radii)
  const varX = s.xx / (n - 1)
  const varY = s.yy / (n - 1)
  const pairs = pairDistances(included)
  out.extremeSpread = pairs.max
  out.minPairDistance = pairs.min
  out.meanPairDistance = pairs.mean
  out.width = Math.max(...xs) - Math.min(...xs)
  out.height = Math.max(...ys) - Math.min(...ys)
  out.meanRadius = meanRadius
  out.standardDeviationX = Math.sqrt(varX)
  out.standardDeviationY = Math.sqrt(varY)
  out.radialStandardDeviation = Math.sqrt(varX + varY)
  out.radiusStandardDeviation = Math.sqrt(
    radii.reduce((a, r) => a + (r - meanRadius) ** 2, 0) / (n - 1),
  )
  out.cep = cepFactor * Math.sqrt((varX + varY) / 2)
  out.covariance = { xx: varX, xy: s.xy / (n - 1), yy: varY }
  out.cepElliptical = ellipticalCep(out.covariance)
  if (!(s.xx === s.yy && s.xy === 0)) out.principalAxisAngle = axisAngle(out.covariance)
  out.confidence = confidenceOf(s.xx, s.yy, n - 1, level)
  return out
}

/** Major-axis direction of a 2 x 2 covariance, rad in (-pi/2, pi/2]. */
function axisAngle(c: GroupCovariance): number {
  const theta = 0.5 * Math.atan2(2 * c.xy, c.xx - c.yy)
  return theta <= -Math.PI / 2 ? theta + Math.PI : theta
}

/** Eigenvalues of a 2 x 2 covariance, major first, both >= 0. */
function eigenvalues(c: GroupCovariance): [number, number] {
  const half = (c.xx + c.yy) / 2
  const root = Math.hypot((c.xx - c.yy) / 2, c.xy)
  return [half + root, Math.max(half - root, 0)]
}

/**
 * Radius R about the centre that holds half of a centred bivariate normal with principal variances
 * l1 >= l2 (`apps/docs/docs/models/groups.md`, "Elliptical CEP"): in whitened polar coordinates the outside share is
 * (2/pi) int_0^{pi/2} exp(-R^2 / (2 (l1 cos^2 phi + l2 sin^2 phi))) dphi, solved for 1/2 by bisection.
 */
function ellipticalCep(c: GroupCovariance): number {
  const [l1, l2] = eigenvalues(c)
  if (l1 === 0) return 0
  const steps = 64 // trapezoid rule on a smooth periodic integrand: below 1e-11 relative even for l2 = 0
  const outside = (r: number) => {
    let sum = 0
    for (let i = 0; i <= steps; i++) {
      const phi = (i * Math.PI) / (2 * steps)
      const term = Math.exp((-r * r) / (2 * (l1 * Math.cos(phi) ** 2 + l2 * Math.sin(phi) ** 2)))
      sum += i === 0 || i === steps ? term / 2 : term
    }
    return sum / steps
  }
  // the circular CEP of the major variance bounds it from above
  return bisect((r) => outside(r) > 0.5, 0, 1.2 * Math.sqrt(l1), 100, true)
}

/** Ellipse about the group centre. */
export interface Ellipse {
  /** Semi-major axis, m. */
  semiMajor: number
  /** Semi-minor axis, m. */
  semiMinor: number
  /** Direction of the major axis, rad from +x counterclockwise; 0 for equal variances. */
  angle: number
}

/** Covariance ellipse about the centre scaled by `k`; `undefined` without covariance. */
function ellipseAt(stats: GroupStatistics, k: number): Ellipse | undefined {
  const c = stats.covariance
  if (!c) return undefined
  const [l1, l2] = eigenvalues(c)
  return {
    semiMajor: k * Math.sqrt(l1),
    semiMinor: k * Math.sqrt(l2),
    angle: stats.principalAxisAngle ?? 0,
  }
}

/**
 * Ellipse about the centre that holds the fraction `coverage` of a bivariate normal population with
 * the sample covariance (`apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses"), a description of
 * the shots fired: semi-axes m, `angle` of the
 * major axis rad from +x (0 for equal variances); `undefined` below 2 shots.
 */
export function dispersionEllipse(stats: GroupStatistics, coverage: number): Ellipse | undefined {
  need(coverage > 0 && coverage < 1, 'coverage must lie in (0, 1)')
  return ellipseAt(stats, Math.sqrt(-2 * Math.log(1 - coverage)))
}

/**
 * Prediction ellipse (`apps/docs/docs/models/groups.md`, "Dispersion and prediction ellipses"): holds a further shot from the same bivariate normal population
 * with probability `coverage`, mean and covariance estimated from the group; scale
 * k^2 = 2 (n^2 - 1) / (n (n - 2)) F(2, n - 2). Same axes as `dispersionEllipse`; `undefined` below 3 shots.
 */
export function predictionEllipse(stats: GroupStatistics, coverage: number): Ellipse | undefined {
  need(coverage > 0 && coverage < 1, 'coverage must lie in (0, 1)')
  const n = stats.shotCount
  if (n < 3) return undefined
  return ellipseAt(
    stats,
    Math.sqrt(((2 * (n * n - 1)) / (n * (n - 2))) * fQuantileTwoNumeratorDegrees(coverage, n - 2)),
  )
}

/** Exact angle, rad, of a segment of `length` centred on the line of sight at `distance` (m): 2 atan(L / 2D). */
export function subtendedAngle(length: number, distance: number): number {
  need(distance > 0, 'distance must be positive')
  return 2 * Math.atan(length / (2 * distance))
}

function pooledValues(
  sxx: number,
  syy: number,
  df: number,
  spreads: number[],
  level: number,
): PooledValues {
  return {
    standardDeviationX: Math.sqrt(sxx / df),
    standardDeviationY: Math.sqrt(syy / df),
    radialStandardDeviation: Math.sqrt((sxx + syy) / df),
    cep: cepFactor * Math.sqrt((sxx + syy) / (2 * df)),
    meanExtremeSpread: mean(spreads),
    confidence: confidenceOf(sxx, syy, df, level),
  }
}

/**
 * Pools groups of one load, each about its own centre and in angle at its own distance
 * (`apps/docs/docs/models/groups.md`, "Angles and pooling"):
 * `angular` always, the length fields only when the pooled groups share one distance (relative
 * difference below 1e-9). The intervals use `confidenceLevel`; the groups' own `confidenceLevel`
 * fields are ignored.
 */
export function pooledGroupStatistics(
  groups: GroupInput[],
  confidenceLevel = 0.95,
): PooledGroupStatistics {
  checkLevel(confidenceLevel)
  for (const g of groups) checkInput(g)
  // sums of squares and extreme spreads in angle: lengths over the group's distance
  let axx = 0
  let ayy = 0
  let df = 0
  const sizes: number[] = []
  const spreads: number[] = []
  const distances: number[] = []
  for (const g of groups) {
    const included = g.shots.filter((s) => !s.excluded)
    if (included.length < 2) continue
    const s = sums(included, centreOf(included))
    const d2 = g.distance * g.distance
    axx += s.xx / d2
    ayy += s.yy / d2
    df += included.length - 1
    sizes.push(included.length)
    spreads.push(pairDistances(included).max / g.distance)
    distances.push(g.distance)
  }
  const out: PooledGroupStatistics = {
    groupCount: sizes.length,
    shotCount: sizes.reduce((a, b) => a + b, 0),
    groupSizes: sizes,
  }
  if (df === 0) return out
  out.angular = pooledValues(axx, ayy, df, spreads, confidenceLevel)
  const d = nth(distances, 0)
  if (distances.every((x) => Math.abs(x - d) <= 1e-9 * d))
    Object.assign(
      out,
      pooledValues(
        axx * d * d,
        ayy * d * d,
        df,
        spreads.map((a) => a * d),
        confidenceLevel,
      ),
    )
  return out
}
