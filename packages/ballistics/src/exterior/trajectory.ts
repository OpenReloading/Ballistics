/** Point-mass (`apps/docs/docs/models/exterior-point-mass.md`) and modified point-mass (`apps/docs/docs/models/exterior-modified-point-mass.md`) trajectory in 3-D; SI in and out, angles in rad; integrated in the local-level ground frame (x downrange, y up, z right), the line of sight an output projection ("Frames"). */
import { nth } from '@open-reloading/statistics'
import { type DragModel, type DragTable, dragTables } from '../drag-tables.ts'
import { InputError, need } from '../issue.ts'
import { overlay, type Settings } from '../settings.ts'
import {
  type Air,
  airAt,
  airDensity,
  checkAir,
  icao,
  minAltitude,
  speedOfSound,
} from './atmosphere.ts'
import {
  type DragInput,
  dragSegment,
  dragTableOf,
  heldSegment,
  inDragTable,
  segmentCoefficient,
} from './drag.ts'
import {
  type Aerodynamics,
  type CoefficientOverMach,
  coefficientAt,
  cylinderInertia,
  gyroscopicStability,
  linearJump,
  momentSlopeFromStability,
  yawOfRepose,
} from './modified.ts'
import { type Rhs, type Rk45Event, type Rk45Hit, rk45, type StepBudget } from './rk45.ts'
import { aerodynamicJump, millerStability, spinDrift } from './stability.ts'

/** Unchecked read of a state vector the caller sizes and indexes by the same count (kept in this module so the integrator loops inline it). */
const el = (a: Float64Array, i: number): number => a[i] ?? 0

/** Projectile of a shot, SI units. */
export interface Projectile {
  /** Projectile mass, kg. */
  mass: number
  /** Reference diameter, m. */
  diameter: number
  /** Length, m; needed for stability, spin drift and jump. */
  length?: number | undefined
  /** Drag input: ballistic coefficient bands or a drag coefficient curve. */
  drag: DragInput
  /** Coefficients of the modified point mass (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Coefficients over Mach"); ignored by the point mass. */
  aerodynamics?: Aerodynamics | undefined
}

/** Firearm and sight of a shot, SI units. */
export interface Firearm {
  /** Line of sight above the bore axis at the muzzle, perpendicular to the line of sight, m. */
  sightHeight: number
  /** Sight to the right of the bore, m. */
  sightOffset?: number | undefined
  /** Twist length per turn, m. */
  twist?: number | undefined
  /** Spin drift and jump need it, and the modified point mass signs the spin by it. */
  twistHand?: 'right' | 'left' | undefined
}

/** Wind over a span of horizontal downrange distance (`apps/docs/docs/models/exterior-point-mass.md`, "Wind"). */
export interface WindSegment {
  /** Horizontal distance where the segment ends, m; the last segment extends to infinity. */
  endDistance: number
  /** Horizontal speed, m/s. */
  speed: number
  /** Direction the wind blows from, rad clockwise from the line of fire: 0 headwind, pi/2 from the right. */
  fromDirection: number
  /** Vertical component, m/s, positive up. */
  vertical?: number | undefined
}

/** Position and direction of fire, for the Earth rotation (`apps/docs/docs/models/exterior-point-mass.md`, "Earth rotation"). */
export interface FiringSite {
  /** Latitude, rad, positive north; switches on Coriolis. */
  latitude?: number | undefined
  /** Azimuth of fire, rad clockwise from true north. */
  azimuth?: number | undefined
}

/** Conditions of the zero (`apps/docs/docs/models/exterior-point-mass.md`, "Zeroing"). */
export interface ZeroSpec {
  /** Zero slant range, m. */
  range: number
  /** Look angle of the zero, rad; default 0. */
  lookAngle?: number | undefined
  /** Air of the zero; default the shot's air. */
  air?: Air | undefined
  /** Wind of the zero; default none. */
  wind?: readonly WindSegment[] | undefined
}

/** Bore direction relative to the line of sight, rad. */
export interface BoreAngles {
  /** Angle of the bore above the line of sight, rad. */
  elevationAngle: number
  /** Angle of the bore to the right of the line of sight, rad. */
  windageAngle: number
}

/** Everything the trajectory depends on except the options and the requested ranges. */
export interface TrajectoryInput {
  /** Mass, dimensions, drag and aerodynamics of the projectile. */
  projectile: Projectile
  /** Muzzle velocity along the bore, relative to the ground, m/s. */
  muzzleVelocity: number
  /** Sight position, twist and twist direction of the firearm. */
  firearm: Firearm
  /** Station air at the firing point. */
  air: Air
  /** Angle of the line of sight above the horizontal, rad; default 0. */
  lookAngle?: number | undefined
  /** Wind by distance segment; default none. */
  wind?: readonly WindSegment[] | undefined
  /** Latitude and azimuth for Coriolis; default none. */
  site?: FiringSite | undefined
  /** Zero conditions (the bore angles are searched), or the bore angles themselves. */
  zero: ZeroSpec | BoreAngles
}

/** Integrator tolerances, limits and model switches of `trajectory` and `zeroAngles`. */
export interface TrajectoryOptions {
  /** Relative error tolerance of the integrator. */
  relativeTolerance: number
  /** m for positions, m/s for velocities, rad/s for the spin of the modified point mass. */
  absoluteTolerance: number
  /** Time of flight at which the run stops, s. */
  maxTime: number
  /** Accepted plus rejected steps before the run fails. */
  maxSteps: number
  /** Constant gravity, m/s2. */
  gravity: number
  /** Apply the Coriolis acceleration; needs a site latitude. */
  coriolis: boolean
  /** Add spin drift; needs length, twist and twist hand. */
  spinDrift: boolean
  /** Add aerodynamic jump; needs length, twist and twist hand (point mass). */
  jump: boolean
  /** Largest miss of the zero search in height and windage, m. */
  zeroTolerance: number
  /** Point-mass model, or the modified point mass of `apps/docs/docs/models/exterior-modified-point-mass.md`. */
  model: 'point-mass' | 'modified-point-mass'
  /** Largest yaw of repose before a modified point-mass run stops, rad (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Yaw limit"). */
  maxYaw: number
  /** Shared with other calls; every integration of the call (zero search, run, twin) adds to it. */
  budget?: StepBudget | undefined
}

/** Defaults of `TrajectoryOptions`; options passed to `trajectory` override them by field. */
const trajectoryDefaults: TrajectoryOptions = {
  relativeTolerance: 1e-8,
  absoluteTolerance: 1e-6,
  maxTime: 120,
  maxSteps: 100000,
  gravity: icao.gravity,
  coriolis: true,
  spinDrift: true,
  jump: true,
  zeroTolerance: 1e-6,
  model: 'point-mass',
  maxYaw: 0.1,
}

/** State of the projectile at one requested slant range. */
export interface TrajectoryPoint {
  /** Slant range along the line of sight, m (the requested value). */
  range: number
  /** Horizontal distance, m. */
  distance: number
  /** Height above the firing point, m. */
  heightAboveFiringPoint: number
  /** Time of flight, s. */
  time: number
  /** Ground-relative speed, m/s. */
  velocity: number
  /** Airspeed over the local speed of sound. */
  mach: number
  /** Kinetic energy, J. */
  energy: number
  /** Height above the line of sight including jump, m; drop is -height. */
  height: number
  /** Right of the line of sight including spin drift, m. */
  windage: number
  /** Spin drift alone, m (included in windage). */
  spinDrift: number
  /** Aerodynamic jump alone, m (included in height). */
  jump: number
  /** Angle of the velocity above the horizontal, rad. */
  pathAngle: number
  /** Angle to hold or dial, rad, positive up. */
  elevationHold: number
  /** Angle to hold or dial, rad, positive right. */
  windageHold: number
  /** True when the Mach number is from 0.8 to 1.2. */
  transonic: boolean
  /** True when the Mach number is below 1. */
  subsonic: boolean
  /** The drag coefficient (modified point mass: or any coefficient) was held at a table end. */
  dragClamped: boolean
  /** Modified point mass: yaw of repose, rad. */
  yaw?: number
  /** Modified point mass: axial spin rate, rad/s, positive for right-hand twist. */
  spin?: number
}

/** Effects not applied in a run: switched off by an option or missing an input. */
export type OmittedEffect =
  | 'coriolis'
  | 'coriolisVertical'
  | 'spinDrift'
  | 'jump'
  | 'spinDecay'
  | 'magnus'

/** Modified point-mass inputs that were estimated, not given (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Gyroscopic stability and the overturning-moment estimate"). */
export type EstimatedInput = 'axialInertia' | 'transverseInertia' | 'momentSlope'

/** Result of `trajectory`. */
export interface Trajectory {
  /** One point per reached requested range, ascending. */
  points: TrajectoryPoint[]
  /** Bore angles of the run, from the zero or as given. */
  bore: BoreAngles
  /** At the muzzle: Miller's rule (point mass, absent without length or twist) or linear theory from the coefficients (modified point mass). */
  stability?: number
  /** All ranges reached, apex of the flight, altitude outside the atmosphere model, `maxTime`, or the yaw limit `maxYaw` (modified point mass). */
  stop: 'done' | 'apex' | 'atmosphere' | 'maxTime' | 'yaw'
  /** Effects left out of this run. */
  omitted: OmittedEffect[]
  /** Modified point mass only: inputs estimated instead of given. */
  estimated?: EstimatedInput[]
  /** Standard drag model of the BC input, or `'custom'` for a drag curve. */
  dragModel: DragModel | 'custom'
  /** Integration steps of this run, accepted plus rejected. */
  steps: number
}

/** 1 mrad in rad. */
export const radPerMrad = 1e-3
/** Earth rotation rate, rad/s (WGS 84). */
export const earthRotationRate = 7.292115e-5

/** In the ground frame (x along the azimuth of fire, y up, z right), rad/s; without an azimuth only the vertical component (`apps/docs/docs/models/exterior-point-mass.md`, "Earth rotation"). */
export function earthRotation(latitude: number, azimuth?: number): [number, number, number] {
  const up = earthRotationRate * Math.sin(latitude)
  if (azimuth === undefined) return [0, up, 0]
  const horizontal = earthRotationRate * Math.cos(latitude)
  return [horizontal * Math.cos(azimuth), up, -horizontal * Math.sin(azimuth)]
}

/** WGS 84 normal gravity at the ellipsoid, m/s2 (Somigliana's closed formula). */
export function normalGravity(latitude: number): number {
  const s2 = Math.sin(latitude) ** 2
  return (9.7803253359 * (1 + 0.00193185265241 * s2)) / Math.sqrt(1 - 0.00669437999013 * s2)
}

/** Modified point-mass inputs after validation and estimates. */
interface Aero {
  liftSlope: CoefficientOverMach
  momentSlope: CoefficientOverMach
  magnusForceSlope: CoefficientOverMach
  spinDamping: CoefficientOverMach
  axialInertia: number
  transverseInertia: number
  /** Initial spin, rad/s, signed by the twist hand. */
  spin0: number
  estimated: EstimatedInput[]
}

interface Conditions {
  shot: TrajectoryInput
  lookAngle: number
  air: Air
  wind: readonly WindSegment[]
  /** Present for the modified point mass. */
  aero?: Aero | undefined
}

type Raw = Omit<TrajectoryPoint, 'spinDrift' | 'jump' | 'elevationHold' | 'windageHold'>

interface Flight {
  points: Raw[]
  stop: Trajectory['stop']
  steps: number
}

type Kind =
  | 'range'
  | 'windUp'
  | 'windDown'
  | 'bandUp'
  | 'bandDown'
  | 'machUp'
  | 'machDown'
  | 'apex'
  | 'atmosphere'
  | 'yaw'

/** Wind segments (one calm segment without wind) and the wind vector of each in the ground frame. */
function windTable(wind: readonly WindSegment[]) {
  const winds = wind.length > 0 ? wind : [{ endDistance: Infinity, speed: 0, fromDirection: 0 }]
  const wv = winds.map((w): [number, number, number] => [
    -w.speed * Math.cos(w.fromDirection),
    w.vertical ?? 0,
    -w.speed * Math.sin(w.fromDirection),
  ])
  const segmentFor = (x: number) => {
    let k = 0
    while (k < winds.length - 1 && x >= nth(winds, k).endDistance) k++
    return k
  }
  return { winds, wv, segmentFor }
}

/** Velocity bands of the drag input in rising `minVelocity`, each with the mass per area S of its drag acceleration. */
function dragBandTable(p: Projectile) {
  const drag = p.drag
  // mass per area S of the drag acceleration, per band in rising minVelocity
  const bands =
    drag.kind === 'curve'
      ? [{ s: p.mass / p.diameter ** 2, minVelocity: 0 }]
      : drag.bands
          .toSorted((a, b) => a.minVelocity - b.minVelocity)
          .map((b) => ({ s: b.ballisticCoefficient, minVelocity: b.minVelocity }))
  const bandFor = (speed: number) => {
    let k = 0
    while (k < bands.length - 1 && speed >= nth(bands, k + 1).minVelocity) k++
    return k
  }
  return { bands, bandFor }
}

/** A Mach number inside grid segment mi: one below the first node, one above the last, else the segment's midpoint. */
function insideSegment(grid: DragTable, mi: number): number {
  const last = grid.length - 1
  if (mi < 0) return nth(grid, 0)[0] - 1
  if (mi >= last) return nth(grid, last)[0] + 1
  return (nth(grid, mi)[0] + nth(grid, mi + 1)[0]) / 2
}

/** The drag table nodes, merged with the coefficient table nodes in M2b; `seg[j][mi + 1]` is the segment of `tables[j]` that holds grid segment mi, `held` marks those read as held. */
function machGrid(table: DragTable, aero: Aero | undefined) {
  const tables: DragTable[] = [table]
  // index in tables by role, not by array identity: a coefficient may be the same array as the drag curve or another coefficient, and then gets its own entry
  const register = (k: CoefficientOverMach) => (typeof k === 'number' ? -1 : tables.push(k) - 1)
  const liftAt = aero ? register(aero.liftSlope) : -1
  const momentAt = aero ? register(aero.momentSlope) : -1
  const magnusAt = aero ? register(aero.magnusForceSlope) : -1
  const dampingAt = aero ? register(aero.spinDamping) : -1
  const grid: DragTable =
    tables.length === 1
      ? table
      : [...new Set(tables.flatMap((k) => k.map((n) => n[0])))]
          .toSorted((a, b) => a - b)
          .map((m) => [m, 0] as const)
  const last = grid.length - 1
  const seg = tables.map((k) =>
    Array.from({ length: grid.length + 1 }, (_, i) => {
      const mi = i - 1
      const m = insideSegment(grid, mi)
      return tables.length === 1 ? mi : dragSegment(k, m)
    }),
  )
  // the slope hold applies to the drag table only (j = 0), the width hold to every table
  const held = tables.map((k, j) => nth(seg, j).map((s) => heldSegment(k, s, j === 0)))
  // grid segment; on a node, the one below it, as the airspeed usually falls
  const segmentAt = (m: number) => {
    const k = dragSegment(grid, m)
    return k >= 0 && nth(grid, k)[0] === m ? k - 1 : k
  }
  return { tables, liftAt, momentAt, magnusAt, dampingAt, grid, last, seg, held, segmentAt }
}

/** Fixed inputs of one flight, its lookup tables, and the segments it is in (they change at restarts). */
interface FlightContext {
  p: Projectile
  air: Air
  aero?: Aero | undefined
  /** Wind vector of each wind segment, ground frame, m/s. */
  wv: [number, number, number][]
  bands: { s: number; minVelocity: number }[]
  table: DragTable
  mg: ReturnType<typeof machGrid>
  /** Earth rotation in the ground frame, rad/s. */
  ox: number
  oy: number
  oz: number
  /** Gravity, m/s2. */
  g: number
  /** Current wind segment, BC band and Mach grid segment. */
  wi: number
  bi: number
  mi: number
}

const airspeedOf = (c: FlightContext, y: Float64Array) => {
  const w = nth(c.wv, c.wi)
  return Math.sqrt((el(y, 3) - w[0]) ** 2 + (el(y, 4) - w[1]) ** 2 + (el(y, 5) - w[2]) ** 2)
}
const machOf = (c: FlightContext, y: Float64Array) =>
  airspeedOf(c, y) / speedOfSound(airAt(c.air, el(y, 1)))

/** Point-mass right-hand side: drag on the airspeed, gravity and Coriolis. */
function pointMassRhs(c: FlightContext): Rhs {
  const { air, table, bands, ox, oy, oz, g } = c
  const seg0 = nth(c.mg.seg, 0)
  const drag = c.p.drag
  // how each grid segment reads the drag table, built once for the integrator loop
  const readings = nth(c.mg.held, 0).map((held) => ({ interpolation: drag.interpolation, held }))
  return (_t, y, dy) => {
    const local = airAt(air, el(y, 1))
    const w = nth(c.wv, c.wi)
    const vax = el(y, 3) - w[0]
    const vay = el(y, 4) - w[1]
    const vaz = el(y, 5) - w[2]
    const va = Math.sqrt(vax * vax + vay * vay + vaz * vaz)
    const k =
      ((Math.PI / 8) *
        airDensity(local) *
        segmentCoefficient(
          table,
          nth(seg0, c.mi + 1),
          va / speedOfSound(local),
          nth(readings, c.mi + 1),
        ) *
        va) /
      nth(bands, c.bi).s
    dy[0] = el(y, 3)
    dy[1] = el(y, 4)
    dy[2] = el(y, 5)
    dy[3] = -k * vax - 2 * (oy * el(y, 5) - oz * el(y, 4))
    dy[4] = -k * vay - g - 2 * (oz * el(y, 3) - ox * el(y, 5))
    dy[5] = -k * vaz - 2 * (ox * el(y, 4) - oy * el(y, 3))
  }
}

/** Point-mass acceleration, yaw of repose from it, then lift, Magnus and spin decay; writes dy/dt and returns the yaw vector. */
function modifiedPointMassRhs(c: FlightContext, pointMass: Rhs) {
  const { air, p } = c
  const { seg, held, liftAt, momentAt, magnusAt, dampingAt } = c.mg
  // how each grid segment of each table reads it, built once for the integrator loop
  const readings = held.map((row) =>
    row.map((h) => ({ interpolation: 'linear' as const, held: h })),
  )
  /** A coefficient on the current grid segment, extended linearly within the step. */
  const coefficient = (k: CoefficientOverMach, j: number, m: number) =>
    typeof k === 'number'
      ? k
      : segmentCoefficient(k, nth(nth(seg, j), c.mi + 1), m, nth(nth(readings, j), c.mi + 1))
  const area = (Math.PI / 4) * p.diameter ** 2
  return (y: Float64Array, dy: Float64Array, a: Aero) => {
    pointMass(0, y, dy)
    const local = airAt(air, el(y, 1))
    const rho = airDensity(local)
    const w = nth(c.wv, c.wi)
    const va = [el(y, 3) - w[0], el(y, 4) - w[1], el(y, 5) - w[2]] as const
    const speed = Math.hypot(va[0], va[1], va[2])
    const m = speed / speedOfSound(local)
    const spinRate = el(y, 6)
    const yaw = yawOfRepose(va, [el(dy, 3), el(dy, 4), el(dy, 5)], spinRate, {
      axialInertia: a.axialInertia,
      momentSlope: coefficient(a.momentSlope, momentAt, m),
      density: rho,
      diameter: p.diameter,
    })
    const kl = ((rho * area) / (2 * p.mass)) * coefficient(a.liftSlope, liftAt, m) * speed ** 2
    // Magnus force -(rho A d / 2m) p C_N-p-alpha (yaw x va), ČOS 109001 eqs. (10) and (27)
    const km =
      -((rho * area * p.diameter) / (2 * p.mass)) *
      spinRate *
      coefficient(a.magnusForceSlope, magnusAt, m)
    dy[3] = el(dy, 3) + (kl * yaw[0] + km * (yaw[1] * va[2] - yaw[2] * va[1]))
    dy[4] = el(dy, 4) + (kl * yaw[1] + km * (yaw[2] * va[0] - yaw[0] * va[2]))
    dy[5] = el(dy, 5) + (kl * yaw[2] + km * (yaw[0] * va[1] - yaw[1] * va[0]))
    dy[6] =
      ((rho * area * p.diameter ** 2) / (2 * a.axialInertia)) *
      coefficient(a.spinDamping, dampingAt, m) *
      speed *
      spinRate
    return yaw
  }
}

/** The output point of state y at time t for the requested slant range. */
function trajectoryPointAt(
  c: FlightContext,
  nx: number,
  ny: number,
  yawAt: (y: Float64Array) => number,
) {
  const { air, p, aero } = c
  const { tables } = c.mg
  return (t: number, y: Float64Array, range: number): Raw => {
    const local = airAt(air, el(y, 1))
    const m = airspeedOf(c, y) / speedOfSound(local)
    const velocity = Math.sqrt(el(y, 3) ** 2 + el(y, 4) ** 2 + el(y, 5) ** 2)
    return {
      range,
      distance: el(y, 0),
      heightAboveFiringPoint: el(y, 1),
      time: t,
      velocity,
      mach: m,
      energy: 0.5 * p.mass * velocity ** 2,
      height: el(y, 0) * nx + el(y, 1) * ny,
      windage: el(y, 2),
      pathAngle: Math.atan2(el(y, 4), Math.hypot(el(y, 3), el(y, 5))),
      transonic: m >= 0.8 && m <= 1.2,
      subsonic: m < 1,
      dragClamped: !tables.every((k) => inDragTable(k, m)),
      ...(aero ? { yaw: yawAt(y), spin: el(y, 6) } : {}),
    }
  }
}

/** What the events of a flight read besides its context: the wind segments, the line of sight, the slant range and the yaw of a state. */
interface Watch {
  winds: readonly WindSegment[]
  /** Unit vector of the line of sight. */
  ux: number
  uy: number
  maxYaw: number
  slant: (y: Float64Array) => number
  yawAt: (y: Float64Array) => number
}

type KindEvent = [Kind, Rk45Event]

/** The pending ranges from index `next`; the last one ends the integration. */
function rangeEvents(
  ranges: readonly number[],
  next: number,
  slant: (y: Float64Array) => number,
): KindEvent[] {
  const out: KindEvent[] = []
  for (let j = next; j < ranges.length; j++) {
    const s = nth(ranges, j)
    out.push([
      'range',
      { eventFunction: (_t, y) => slant(y) - s, direction: 1, terminal: j === ranges.length - 1 },
    ])
  }
  return out
}

/** A terminal event where `f` of the state crosses `edge` in `direction`. */
const crossingOf = (
  f: (y: Float64Array) => number,
  edge: number,
  direction: -1 | 1,
): Rk45Event => ({
  eventFunction: (_t, y) => f(y) - edge,
  direction,
  terminal: true,
})

const distance = (y: Float64Array) => el(y, 0)

/** The boundaries of the current wind segment, BC band and Mach grid segment, each a restart. */
function boundaryEvents(c: FlightContext, winds: readonly WindSegment[]): KindEvent[] {
  const { bands, wi, bi, mi } = c
  const { grid, last } = c.mg
  const airspeed = (y: Float64Array) => airspeedOf(c, y)
  const mach = (y: Float64Array) => machOf(c, y)
  const out: KindEvent[] = []
  if (wi > 0) out.push(['windDown', crossingOf(distance, nth(winds, wi - 1).endDistance, -1)])
  if (wi < winds.length - 1)
    out.push(['windUp', crossingOf(distance, nth(winds, wi).endDistance, 1)])
  if (bi > 0) out.push(['bandDown', crossingOf(airspeed, nth(bands, bi).minVelocity, -1)])
  if (bi < bands.length - 1)
    out.push(['bandUp', crossingOf(airspeed, nth(bands, bi + 1).minVelocity, 1)])
  // table nodes are kinks in Cd(Mach): restart there so that no step crosses one
  if (mi >= 0) out.push(['machDown', crossingOf(mach, nth(grid, mi)[0], -1)])
  if (mi < last) out.push(['machUp', crossingOf(mach, nth(grid, mi + 1)[0], 1)])
  return out
}

/** The ends of a flight: the apex, the yaw limit and the limits of the atmosphere model. */
function limitEvents(c: FlightContext, watch: Watch): KindEvent[] {
  const { ux, uy, yawAt, maxYaw } = watch
  const altitude = c.air.altitude
  const out: KindEvent[] = [
    [
      'apex',
      { eventFunction: (_t, y) => el(y, 3) * ux + el(y, 4) * uy, direction: -1, terminal: true },
    ],
  ]
  if (c.aero)
    out.push(['yaw', { eventFunction: (_t, y) => yawAt(y) - maxYaw, direction: 1, terminal: true }])
  out.push(
    [
      'atmosphere',
      {
        eventFunction: (_t, y) => altitude + el(y, 1) - icao.tropopause,
        direction: 1,
        terminal: true,
      },
    ],
    [
      'atmosphere',
      {
        eventFunction: (_t, y) => altitude + el(y, 1) - minAltitude,
        direction: -1,
        terminal: true,
      },
    ],
  )
  return out
}

/** The pending ranges, the segment boundaries of wind, BC band and Mach grid, the apex, the yaw limit and the atmosphere limits. */
function flightEvents(
  c: FlightContext,
  watch: Watch,
  ranges: readonly number[],
  next: number,
): { kinds: Kind[]; events: Rk45Event[] } {
  const all = [
    ...rangeEvents(ranges, next, watch.slant),
    ...boundaryEvents(c, watch.winds),
    ...limitEvents(c, watch),
  ]
  return { kinds: all.map(([kind]) => kind), events: all.map(([, event]) => event) }
}

/** The rotation of the earth in the frame of the shot, zero without the coriolis effect or a site. */
function earthRotationOf(shot: TrajectoryInput, o: TrajectoryOptions): [number, number, number] {
  const lat = shot.site?.latitude
  return o.coriolis && lat !== undefined ? earthRotation(lat, shot.site?.azimuth) : [0, 0, 0]
}

/** Position, velocity and spin at the muzzle, in the frame of the line of sight. */
function launchState(c: Conditions, bore: BoreAngles, ux: number, uy: number) {
  const { muzzleVelocity: v0, firearm } = c.shot
  const nx = -uy
  const ny = ux
  const bu = Math.cos(bore.elevationAngle) * Math.cos(bore.windageAngle)
  const bn = Math.sin(bore.elevationAngle)
  const bz = Math.cos(bore.elevationAngle) * Math.sin(bore.windageAngle)
  const hs = firearm.sightHeight
  return Float64Array.of(
    -hs * nx,
    -hs * ny,
    -(firearm.sightOffset ?? 0),
    v0 * (bu * ux + bn * nx),
    v0 * (bu * uy + bn * ny),
    v0 * bz,
    ...(c.aero ? [c.aero.spin0] : []),
  )
}

/** The restart state lies on either side of the crossed boundary; wind first, because the airspeed depends on it. */
function restartSegments(
  fc: FlightContext,
  winds: readonly WindSegment[],
  kind: Kind,
  y: Float64Array,
) {
  const d = kind.endsWith('Up') ? 1 : -1
  const along = (prefix: string) => (kind.startsWith(prefix) ? d : 0)
  fc.wi = settle(fc.wi, along('wind'), el(y, 0), {
    lo: 0,
    hi: winds.length - 1,
    edge: (k) => nth(winds, k - 1).endDistance,
  })
  fc.bi = settle(fc.bi, along('band'), airspeedOf(fc, y), {
    lo: 0,
    hi: fc.bands.length - 1,
    edge: (k) => nth(fc.bands, k).minVelocity,
  })
  fc.mi = settle(fc.mi, along('mach'), machOf(fc, y), {
    lo: -1,
    hi: fc.mg.last,
    edge: (k) => nth(fc.mg.grid, k)[0],
  })
}

const endsFlight = (kind: Kind): kind is 'apex' | 'atmosphere' | 'yaw' =>
  kind === 'apex' || kind === 'atmosphere' || kind === 'yaw'

/** The fixed inputs and lookup tables of one flight, with its segments at the muzzle state `y0`. */
function flightContext(c: Conditions, o: TrajectoryOptions, y0: Float64Array) {
  const { projectile: p } = c.shot
  const { winds, wv, segmentFor } = windTable(c.wind)
  const table = dragTableOf(p.drag)
  const { bands, bandFor } = dragBandTable(p)
  const [ox, oy, oz] = earthRotationOf(c.shot, o)
  const mg = machGrid(table, c.aero)
  const fc: FlightContext = {
    p,
    air: c.air,
    aero: c.aero,
    wv,
    bands,
    table,
    mg,
    ox,
    oy,
    oz,
    g: o.gravity,
    wi: segmentFor(el(y0, 0)),
    bi: 0,
    mi: 0,
  }
  fc.bi = bandFor(airspeedOf(fc, y0))
  fc.mi = mg.segmentAt(machOf(fc, y0))
  return { fc, winds }
}

/** The right-hand side of a flight and the yaw of a state: the modified point mass with aerodynamic data, else the point mass and yaw 0. */
function flightDynamics(fc: FlightContext): { rhs: Rhs; yawAt: (y: Float64Array) => number } {
  const aero = fc.aero
  const pointMass = pointMassRhs(fc)
  const mpm = modifiedPointMassRhs(fc, pointMass)
  const scratch = new Float64Array(7)
  const yawAt = (y: Float64Array) => (aero ? Math.hypot(...mpm(y, scratch, aero)) : 0)
  const rhs: Rhs = aero
    ? (_t, y, dy) => {
        mpm(y, dy, aero)
      }
    : pointMass
  return { rhs, yawAt }
}

/** The output points of a flight: the ranges in order, each recorded once the state reaches it. */
function pointRecorder(
  ranges: readonly number[],
  slant: (y: Float64Array) => number,
  point: (t: number, y: Float64Array, range: number) => Raw,
) {
  const points: Raw[] = []
  let next = 0
  return {
    points,
    /** Index of the first range not recorded yet. */
    next: () => next,
    /** Records pending ranges the state has reached (start, and rounding at restarts). */
    catchUp(t: number, y: Float64Array) {
      while (next < ranges.length && nth(ranges, next) <= slant(y))
        points.push(point(t, y, nth(ranges, next++)))
    },
    /** Records the hits of the pending range events, in order, from the event index `first`. */
    recordHits(hits: readonly Rk45Hit[], first: number) {
      for (const hit of hits)
        if (first + hit.event === next) points.push(point(hit.t, hit.y, nth(ranges, next++)))
    },
    /** Records every pending range at the state of the last range. */
    recordRest(t: number, y: Float64Array) {
      while (next < ranges.length) points.push(point(t, y, nth(ranges, next++)))
    },
  }
}

/** The integrator options of one integration of a flight, after `steps` steps, starting with step `h`. */
const stepOptions = (o: TrajectoryOptions, steps: number, h: number | undefined) => ({
  relativeTolerance: o.relativeTolerance,
  absoluteTolerance: o.absoluteTolerance,
  maxSteps: o.maxSteps,
  stepsBefore: steps,
  maxTime: o.maxTime,
  initialStep: h,
  budget: o.budget,
})

/** Integrates one trajectory with fixed bore angles; corrections are added by the caller. */
function fly(c: Conditions, bore: BoreAngles, ranges: number[], o: TrajectoryOptions): Flight {
  const ux = Math.cos(c.lookAngle)
  const uy = Math.sin(c.lookAngle)
  const nx = -uy
  const ny = ux
  const y0 = launchState(c, bore, ux, uy)
  const { fc, winds } = flightContext(c, o, y0)
  const { rhs, yawAt } = flightDynamics(fc)
  const slant = (y: Float64Array) => el(y, 0) * ux + el(y, 1) * uy
  const record = pointRecorder(ranges, slant, trajectoryPointAt(fc, nx, ny, yawAt))
  const { points } = record
  const watch: Watch = { winds, ux, uy, maxYaw: o.maxYaw, slant, yawAt }

  let t = 0
  let y: Float64Array = y0
  let h: number | undefined
  let steps = 0
  record.catchUp(t, y)
  if (el(y, 3) * ux + el(y, 4) * uy <= 0) return { points, stop: 'apex', steps }
  while (record.next() < ranges.length) {
    // at the muzzle and after every restart, where the yaw can jump (wind, BC band)
    if (fc.aero && yawAt(y) >= o.maxYaw) return { points, stop: 'yaw', steps }
    const first = record.next()
    const { kinds, events } = flightEvents(fc, watch, ranges, first)
    const r = rk45({ f: rhs, t0: t, y0: y, events }, stepOptions(o, steps, h))
    steps += r.steps
    record.recordHits(r.hits, first)
    t = r.t
    y = r.y
    h = r.h
    if (r.event === null) return { points, stop: 'maxTime', steps }
    const kind = nth(kinds, r.event)
    if (kind === 'range') {
      record.recordRest(t, y)
      break
    }
    record.catchUp(t, y)
    if (endsFlight(kind)) return { points, stop: kind, steps }
    restartSegments(fc, winds, kind, y)
  }
  return { points, stop: 'done', steps }
}

/** Segments `lo` to `hi` of a value; segment k spans edge(k) to edge(k + 1). */
interface Segments {
  lo: number
  hi: number
  edge: (k: number) => number
}

/** The index after a restart without a crossing: past the boundaries `v` lies strictly beyond. */
function settleWithoutCrossing(k: number, v: number, { lo, hi, edge }: Segments): number {
  let j = k
  while (j > lo && v < edge(j)) j--
  while (j < hi && v > edge(j + 1)) j++
  return j
}

/** A crossing in direction d moves past the crossed boundary b and every further one within |v - b| of b or at or beyond v (closer than the event resolution); without one (d = 0) only past boundaries that v lies strictly beyond, whose events could no longer fire. */
function settle(k: number, d: -1 | 0 | 1, v: number, segments: Segments): number {
  const { lo, hi, edge } = segments
  let j = k
  if (d === 0) return settleWithoutCrossing(j, v, segments)
  const b = edge(d > 0 ? j + 1 : j)
  const reach = d > 0 ? Math.max(v, 2 * b - v) : Math.min(v, 2 * b - v)
  j += d
  if (d > 0) while (j < hi && edge(j + 1) <= reach) j++
  else while (j > lo && edge(j) >= reach) j--
  return j
}

const finite = (x: number | undefined) => x === undefined || Number.isFinite(x)

function checkWind(wind: readonly WindSegment[]): void {
  wind.forEach((w, k) => {
    need(Number.isFinite(w.speed) && Number.isFinite(w.fromDirection) && finite(w.vertical), {
      code: 'windSegmentInvalid',
      params: {},
    })
    need(k === 0 || w.endDistance > nth(wind, k - 1).endDistance, {
      code: 'windSegmentsNotRising',
      params: {},
    })
  })
}

/** Checks a drag input: BC bands against a standard model, or a drag curve, and the interpolation. */
function checkDragInput(drag: DragInput): void {
  if (drag.kind === 'bc') {
    need(drag.model in dragTables, { code: 'dragModelUnknown', params: { model: drag.model } })
    const bands = drag.bands
    need(bands.length > 0, { code: 'noBcBand', params: {} })
    for (const b of bands)
      need(
        b.ballisticCoefficient > 0 &&
          Number.isFinite(b.ballisticCoefficient) &&
          b.minVelocity >= 0 &&
          Number.isFinite(b.minVelocity),
        { code: 'bcBandInvalid', params: {} },
      )
    need(new Set(bands.map((b) => b.minVelocity)).size === bands.length, {
      code: 'bcBandsSameSpeed',
      params: {},
    })
    const reference = drag.reference
    need(reference === undefined || reference === 'icao' || reference === 'metro', {
      code: 'bcReferenceUnknown',
      params: { reference: String(reference) },
    })
  } else {
    const curve = drag.curve
    need(curve.length >= 2, { code: 'dragCurveTooShort', params: {} })
    curve.forEach(([mach, cd], k) => {
      need(Number.isFinite(mach) && cd >= 0 && Number.isFinite(cd), {
        code: 'dragCurveNodeInvalid',
        params: {},
      })
      need(k === 0 || mach > nth(curve, k - 1)[0], { code: 'dragCurveMachNotRising', params: {} })
    })
  }
  const interpolation = drag.interpolation
  need(
    interpolation === undefined || interpolation === 'linear' || interpolation === 'monotone-cubic',
    { code: 'dragInterpolationUnknown', params: { interpolation: String(interpolation) } },
  )
}

/** Checks mass, diameter, length and drag input of the projectile. */
function checkProjectile(p: Projectile): void {
  need(p.mass > 0 && Number.isFinite(p.mass), { code: 'massNotPositive', params: {} })
  need(p.diameter > 0 && Number.isFinite(p.diameter), { code: 'diameterNotPositive', params: {} })
  need(p.length === undefined || (p.length > 0 && Number.isFinite(p.length)), {
    code: 'lengthNotPositive',
    params: {},
  })
  checkDragInput(p.drag)
}

const look = (a: number | undefined) => a === undefined || Math.abs(a) <= Math.PI / 2

/** Checks the sight and the twist of the firearm. */
function checkFirearm(firearm: Firearm): void {
  need(Number.isFinite(firearm.sightHeight) && finite(firearm.sightOffset), {
    code: 'sightInvalid',
    params: {},
  })
  need(firearm.twist === undefined || (firearm.twist > 0 && Number.isFinite(firearm.twist)), {
    code: 'twistNotPositive',
    params: {},
  })
}

/** Checks the zero: its range, look angle, air and wind, or the bore angles. */
function checkZero(zero: ZeroSpec | BoreAngles): void {
  if ('range' in zero) {
    need(zero.range > 0 && Number.isFinite(zero.range), {
      code: 'zeroRangeNotPositive',
      params: {},
    })
    need(look(zero.lookAngle), { code: 'zeroLookAngleOutsideRange', params: {} })
    if (zero.air) checkAir(zero.air)
    checkWind(zero.wind ?? [])
  } else
    need(Number.isFinite(zero.elevationAngle) && Number.isFinite(zero.windageAngle), {
      code: 'boreAnglesInvalid',
      params: {},
    })
}

/** Checks firearm, look angle, air, wind, site and zero of the shot. */
function checkConditions(shot: TrajectoryInput): void {
  const { firearm, site, zero } = shot
  checkFirearm(firearm)
  need(look(shot.lookAngle), { code: 'lookAngleOutsideRange', params: {} })
  checkAir(shot.air)
  checkWind(shot.wind ?? [])
  need(site?.latitude === undefined || Math.abs(site.latitude) <= Math.PI / 2, {
    code: 'latitudeInvalid',
    params: {},
  })
  need(finite(site?.azimuth), { code: 'azimuthInvalid', params: {} })
  checkZero(zero)
}

/** Checks the tolerances, limits and switches of the options. */
function checkOptions(o: TrajectoryOptions): void {
  need(o.relativeTolerance > 0 && o.absoluteTolerance > 0 && o.maxTime > 0 && o.maxSteps > 0, {
    code: 'tolerancesInvalid',
    params: {},
  })
  need(o.budget === undefined || (o.budget.used >= 0 && o.budget.max >= 0), {
    code: 'stepBudgetInvalid',
    params: {},
  })
  need(Number.isFinite(o.gravity), { code: 'gravityInvalid', params: {} })
  need(o.zeroTolerance > 0 && o.maxYaw > 0, {
    code: 'zeroToleranceOrMaxYawNotPositive',
    params: {},
  })
  need(o.model === 'point-mass' || o.model === 'modified-point-mass', {
    code: 'modelUnknown',
    params: { model: o.model },
  })
}

function checkShot(shot: TrajectoryInput, o: TrajectoryOptions): void {
  checkProjectile(shot.projectile)
  need(shot.muzzleVelocity > 0 && Number.isFinite(shot.muzzleVelocity), {
    code: 'muzzleVelocityNotPositive',
    params: {},
  })
  checkConditions(shot)
  checkOptions(o)
}

function checkCoefficient(k: CoefficientOverMach | undefined, name: string): void {
  if (k === undefined) return
  if (typeof k === 'number') {
    need(Number.isFinite(k), { code: 'coefficientNotFinite', params: { name } })
    return
  }
  need(k.length >= 2, { code: 'coefficientTableTooShort', params: { name } })
  k.forEach(([mach, value], j) => {
    need(Number.isFinite(mach) && Number.isFinite(value), {
      code: 'coefficientTableNodeInvalid',
      params: { name },
    })
    need(j === 0 || mach > nth(k, j - 1)[0], {
      code: 'coefficientTableMachNotRising',
      params: { name },
    })
  })
}

/** Checks the modified point-mass inputs; returns the coefficients. */
function checkAerodynamics(shot: TrajectoryInput): Aerodynamics {
  const { projectile: p, firearm } = shot
  const a = p.aerodynamics
  if (a === undefined)
    throw new InputError({ code: 'modifiedPointMassNeedsAerodynamics', params: {} })
  need(firearm.twist !== undefined && firearm.twistHand !== undefined, {
    code: 'modifiedPointMassNeedsTwist',
    params: {},
  })
  need(a.liftSlope !== undefined, { code: 'modifiedPointMassNeedsLiftSlope', params: {} })
  checkCoefficient(a.liftSlope, 'liftSlope')
  checkCoefficient(a.momentSlope, 'momentSlope')
  checkCoefficient(a.magnusForceSlope, 'magnusForceSlope')
  checkCoefficient(a.spinDamping, 'spinDamping')
  return a
}

/** Axial and transverse moments of inertia, the missing ones from a uniform cylinder; adds them to `estimated`. */
function estimateInertias(
  p: Projectile,
  a: Aerodynamics,
  estimated: EstimatedInput[],
): { ix: number; iy: number } {
  let { axialInertia: ix, transverseInertia: iy } = a
  if (ix === undefined || iy === undefined) {
    need(p.length !== undefined, { code: 'inertiaNeedsLength', params: {} })
    const cyl = cylinderInertia(p.mass, p.diameter, p.length ?? 0)
    if (ix === undefined) {
      ix = cyl.axial
      estimated.push('axialInertia')
    }
    if (iy === undefined) {
      iy = cyl.transverse
      estimated.push('transverseInertia')
    }
  }
  need(ix > 0 && Number.isFinite(ix) && iy > 0 && Number.isFinite(iy), {
    code: 'inertiaNotPositive',
    params: {},
  })
  return { ix, iy }
}

/** Overturning-moment slope that gives Miller's stability factor at the muzzle. */
function estimateMomentSlope(shot: TrajectoryInput, ix: number, iy: number, spin0: number): number {
  const { projectile: p, firearm } = shot
  const v0 = shot.muzzleVelocity
  need(p.length !== undefined, { code: 'momentSlopeNeedsLength', params: {} })
  const stability = millerStability({
    mass: p.mass,
    diameter: p.diameter,
    length: p.length ?? 0,
    twist: firearm.twist ?? 0,
    velocity: v0,
    air: shot.air,
  })
  return momentSlopeFromStability({
    axialInertia: ix,
    transverseInertia: iy,
    spin: spin0,
    density: airDensity(shot.air),
    speed: v0,
    diameter: p.diameter,
    stability,
  })
}

/** Validates the modified point-mass inputs and fills the estimates. */
function resolveAero(shot: TrajectoryInput): Aero {
  const { projectile: p, firearm } = shot
  const a = checkAerodynamics(shot)
  const estimated: EstimatedInput[] = []
  const v0 = shot.muzzleVelocity
  const spin0 = ((firearm.twistHand === 'left' ? -2 : 2) * Math.PI * v0) / (firearm.twist ?? 1)
  const { ix, iy } = estimateInertias(p, a, estimated)
  let momentSlope = a.momentSlope
  if (momentSlope === undefined) {
    momentSlope = estimateMomentSlope(shot, ix, iy, spin0)
    estimated.push('momentSlope')
  }
  const cma = momentSlope
  need(typeof cma === 'number' ? cma > 0 : cma.every((n) => n[1] > 0), {
    code: 'momentSlopeNotPositive',
    params: {},
  })
  return {
    liftSlope: a.liftSlope,
    momentSlope: cma,
    magnusForceSlope: a.magnusForceSlope ?? 0,
    spinDamping: a.spinDamping ?? 0,
    axialInertia: ix,
    transverseInertia: iy,
    spin0,
    estimated,
  }
}

/** Spin drift and jump inputs; null when twist, hand or length is missing. */
function spin(shot: TrajectoryInput, air: Air) {
  const { projectile: p, firearm } = shot
  if (p.length === undefined || firearm.twist === undefined) return null
  const sg = millerStability({
    mass: p.mass,
    diameter: p.diameter,
    length: p.length,
    twist: firearm.twist,
    velocity: shot.muzzleVelocity,
    air,
  })
  return { sg, hand: firearm.twistHand, calibres: p.length / p.diameter }
}

/** Adds spin drift, jump (`apps/docs/docs/models/exterior-stability.md`) and the holds; in M2b the drift is integrated, `twin` maps range to the point-mass twin's windage, and the jump comes from linear theory (`apps/docs/docs/models/exterior-modified-point-mass.md`, "Spin drift column", "Aerodynamic jump"). */
function correct(
  c: Conditions,
  raw: Raw[],
  o: TrajectoryOptions,
  twin?: Map<number, number>,
): TrajectoryPoint[] {
  const s = spin(c.shot, c.air)
  const hand = s?.hand
  const first = c.wind[0]
  const crosswind = first ? -first.speed * Math.sin(first.fromDirection) : 0
  const a = c.aero
  let jumpAngle = 0
  if (a && o.jump) {
    const v0 = c.shot.muzzleVelocity
    const m0 = v0 / speedOfSound(c.air)
    jumpAngle = linearJump({
      axialInertia: a.axialInertia,
      spin: a.spin0,
      mass: c.shot.projectile.mass,
      diameter: c.shot.projectile.diameter,
      speed: v0,
      liftSlope: coefficientAt(a.liftSlope, m0),
      momentSlope: coefficientAt(a.momentSlope, m0),
      crosswind,
    })
  } else if (!a && s && hand && o.jump)
    jumpAngle = aerodynamicJump(s.sg, s.calibres, crosswind, hand)
  return raw.map((q) => {
    const fit = !a && s && hand && o.spinDrift ? spinDrift(s.sg, q.time, hand) : 0
    const drift = a ? twinDrift(q, twin) : fit
    const jump = q.range * Math.tan(jumpAngle)
    const height = q.height + jump
    const windage = q.windage + fit
    return {
      ...q,
      height,
      windage,
      spinDrift: drift,
      jump,
      elevationHold: q.range > 0 ? -Math.atan2(height, q.range) : 0,
      windageHold: q.range > 0 ? -Math.atan2(windage, q.range) : 0,
    }
  })
}

/** The spin drift of the modified point mass: the windage beyond its point-mass twin, 0 without one. */
function twinDrift(q: Raw, twin: Map<number, number> | undefined): number {
  // shortcut: NaN when the twin run stops before this range; rare, as the twin has no yaw stop
  return twin ? q.windage - (twin.get(q.range) ?? Number.NaN) : 0
}

const resolve = (options?: Settings<TrajectoryOptions>): TrajectoryOptions =>
  overlay(trajectoryDefaults, options)

const aeroFor = (shot: TrajectoryInput, o: TrajectoryOptions) =>
  o.model === 'modified-point-mass' ? resolveAero(shot) : undefined

function zeroWith(shot: TrajectoryInput, o: TrajectoryOptions, aero: Aero | undefined): BoreAngles {
  const zero = shot.zero
  if (!('range' in zero)) return zero
  const c: Conditions = {
    shot,
    lookAngle: zero.lookAngle ?? 0,
    air: zero.air ?? shot.air,
    wind: zero.wind ?? [],
    aero,
  }
  const range = zero.range
  const miss = (bore: BoreAngles): [number, number] => {
    const f = fly(c, bore, [range], o)
    if (f.points.length === 0)
      throw new InputError({ code: 'zeroRangeNotReached', params: { range, stop: f.stop } })
    const q = nth(correct(c, f.points, o), 0)
    return [q.height, q.windage]
  }
  // flat-fire vacuum estimate, then a secant on elevation and a linear step on windage
  const v0 = shot.muzzleVelocity
  let bore = {
    elevationAngle: Math.atan(
      (shot.firearm.sightHeight +
        (o.gravity * range ** 2 * Math.cos(c.lookAngle)) / (2 * v0 ** 2)) /
        range,
    ),
    windageAngle: 0,
  }
  let [h, w] = miss(bore)
  let prev = { elevationAngle: bore.elevationAngle, height: h }
  bore = { elevationAngle: bore.elevationAngle - h / range, windageAngle: -w / range }
  for (let i = 0; i < 30; i++) {
    ;[h, w] = miss(bore)
    if (Math.abs(h) < o.zeroTolerance && Math.abs(w) < o.zeroTolerance) return bore
    const slope = (h - prev.height) / (bore.elevationAngle - prev.elevationAngle)
    prev = { elevationAngle: bore.elevationAngle, height: h }
    bore = {
      elevationAngle:
        bore.elevationAngle - h / (Number.isFinite(slope) && slope !== 0 ? slope : range),
      windageAngle: bore.windageAngle - w / range,
    }
  }
  throw new InputError({ code: 'zeroNotConverged', params: { vertical: h, horizontal: w } })
}

/** Bore angles that put the impact on the line of sight at the zero range (`apps/docs/docs/models/exterior-point-mass.md`, "Zeroing"). */
export function zeroAngles(
  shot: TrajectoryInput,
  options?: Settings<TrajectoryOptions>,
): BoreAngles {
  const o = resolve(options)
  checkShot(shot, o)
  return zeroWith(shot, o, aeroFor(shot, o))
}

/** Gyroscopic stability factor at the muzzle of a shot with aerodynamic data. */
function aeroStability(shot: TrajectoryInput, aero: Aero) {
  const v0 = shot.muzzleVelocity
  return gyroscopicStability({
    axialInertia: aero.axialInertia,
    transverseInertia: aero.transverseInertia,
    spin: aero.spin0,
    density: airDensity(shot.air),
    speed: v0,
    diameter: shot.projectile.diameter,
    momentSlope: coefficientAt(aero.momentSlope, v0 / speedOfSound(shot.air)),
  })
}

const coriolisOmitted = (shot: TrajectoryInput, o: TrajectoryOptions): OmittedEffect[] => {
  const site = shot.site
  if (!o.coriolis || site?.latitude === undefined) return ['coriolis']
  return site.azimuth === undefined ? ['coriolisVertical'] : []
}

/** The effects the modified point mass leaves out: the jump when off, spin decay and Magnus without their coefficients. */
function aeroOmitted(shot: TrajectoryInput, o: TrajectoryOptions): OmittedEffect[] {
  const omitted: OmittedEffect[] = []
  if (!o.jump) omitted.push('jump')
  if (shot.projectile.aerodynamics?.spinDamping === undefined) omitted.push('spinDecay')
  if (shot.projectile.aerodynamics?.magnusForceSlope === undefined) omitted.push('magnus')
  return omitted
}

/** The effects the point mass leaves out: the spin drift and jump fits when off or without a twist. */
function fitOmitted(s: ReturnType<typeof spin>, o: TrajectoryOptions): OmittedEffect[] {
  const omitted: OmittedEffect[] = []
  if (!(s?.hand && o.spinDrift)) omitted.push('spinDrift')
  if (!(s?.hand && o.jump)) omitted.push('jump')
  return omitted
}

/** The effects the result leaves out, from the options and the data the shot carries. */
function omittedEffects(
  shot: TrajectoryInput,
  o: TrajectoryOptions,
  s: ReturnType<typeof spin>,
  aero: Aero | undefined,
): OmittedEffect[] {
  return [...coriolisOmitted(shot, o), ...(aero ? aeroOmitted(shot, o) : fitOmitted(s, o))]
}

/** Trajectory at the requested slant ranges, m. */
export function trajectory(
  shot: TrajectoryInput,
  ranges: readonly number[],
  options?: Settings<TrajectoryOptions>,
): Trajectory {
  const o = resolve(options)
  checkShot(shot, o)
  for (const s of ranges)
    need(s >= 0 && Number.isFinite(s), { code: 'rangeInvalid', params: { range: s } })
  const aero = aeroFor(shot, o)
  const bore = zeroWith(shot, o, aero)
  const c: Conditions = {
    shot,
    lookAngle: shot.lookAngle ?? 0,
    air: shot.air,
    wind: shot.wind ?? [],
    aero,
  }
  const sorted = [...new Set(ranges)].toSorted((a, b) => a - b)
  const f = fly(c, bore, sorted, o)
  const s = spin(shot, shot.air)
  let twin: Map<number, number> | undefined
  let stability = s?.sg
  if (aero) {
    // spin drift column of M2b: windage against a point-mass twin at the same bore
    const t = fly({ ...c, aero: undefined }, bore, sorted, o)
    twin = new Map(t.points.map((q) => [q.range, q.windage]))
    stability = aeroStability(shot, aero)
  }
  const omitted = omittedEffects(shot, o, s, aero)
  return {
    points: correct(c, f.points, o, twin),
    bore,
    ...(stability === undefined ? {} : { stability }),
    stop: f.stop,
    omitted,
    ...(aero ? { estimated: aero.estimated } : {}),
    dragModel: shot.projectile.drag.kind === 'curve' ? 'custom' : shot.projectile.drag.model,
    steps: f.steps,
  }
}
