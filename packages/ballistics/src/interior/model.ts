/** M3 interior model with Noble-Abel gas, `apps/docs/docs/models/interior-m3.md`; SI in and out, temperatures in K. */

import { bisect, InputError, nth } from '@rangefoundry/statistics'

import { icao } from '../exterior/atmosphere.ts'
import {
  type Rhs,
  type Rk45Event,
  type Rk45Options,
  type Rk45Problem,
  rk45,
} from '../exterior/rk45.ts'
import { overlay, type Settings } from '../settings.ts'
import { type Burn, burnError, burnForm } from './form.ts'
import { wornVolume } from './throat-wear.ts'

/** Unchecked read of a state vector the caller sizes and indexes by the same count (kept in this module so the integrator loops inline it). */
const el = (a: Float64Array, i: number): number => a[i] ?? 0

/** Chamber, barrel, bullet, charge and propellant of one `interior` run, SI units. */
export interface InteriorLoad {
  chamber: {
    /** Volume behind the seated projectile base, m3. */
    volume: number
    /** Bore area, m2. */
    boreArea: number
    /** Bore diameter, m: heat-loss area and the default radius of gyration. */
    boreDiameter: number
    /** Throat wear, m: the length a worn throat adds behind the bullet, times the bore area added to `volume`; default 0 (`apps/docs/docs/models/interior-m3.md`, "Throat wear"). */
    throatWear?: number | undefined
    /** Cross-section area of the chamber body, m2: given, the pressure gradient takes its chambrage form; absent, the chamber counts as a cylinder of the bore area (`apps/docs/docs/models/interior-m3.md`, "Chambrage"). */
    area?: number | undefined
  }
  barrel: {
    /** Projectile travel from the seated position to the muzzle, m. */
    length: number
    /** Twist length, m per turn; 0 without rifling. */
    twist: number
  }
  bullet: {
    /** Bullet mass, kg. */
    mass: number
    /** Axial radius of gyration, m; default boreDiameter / (2 sqrt 2), a solid cylinder. */
    gyrationRadius?: number | undefined
  }
  /** Charge mass, kg. */
  charge: number
  propellant: {
    /** Specific energy at constant volume, J/kg; the force constant is (gamma - 1) specificEnergy. */
    specificEnergy: number
    /** Ratio of specific heats of the gas. */
    gamma: number
    /** Solid density, kg/m3. */
    density: number
    /** Covolume, m3/kg. */
    covolume: number
    /** Burn law and its grain or form function. */
    burn: Burn
    /** Burn-rate temperature sensitivity, 1/K, below (cold) and above (hot) the reference, K (`apps/docs/docs/models/interior-m3.md`, "Temperature of the propellant"). */
    temperatureSensitivity?: { reference: number; cold: number; hot: number } | undefined
    /** Sensitivity of the specific energy to the propellant temperature, 1/K, default 0: the energy scales by exp(energyTemperature (T - reference)) with the reference of `temperatureSensitivity`, which a nonzero value needs (`apps/docs/docs/models/interior-m3.md`, "Temperature of the propellant"). */
    energyTemperature?: number | undefined
  }
  /** Propellant temperature, K. */
  propellantTemperature: number
  /** Pressure of the gas present when the integration starts, Pa (`apps/docs/docs/models/interior-m3.md`, "Ignition"). */
  ignitionPressure: number
  /** Mean pressure at which the projectile may start to move, Pa (`apps/docs/docs/models/interior-m3.md`, "Shot start"). */
  startPressure: number
  /** Bore resistance as pressures on the bore area (`apps/docs/docs/models/interior-m3.md`, "Bore resistance"). */
  resistance?:
    | {
        /** Constant friction pressure, Pa. */
        friction?: number | undefined
        /** Engraving pressure over travel, m and Pa, interpolated linearly, 0 outside. */
        engraving?: readonly { travel: number; pressure: number }[] | undefined
      }
    | undefined
  /** Pressure-gradient coefficients (`apps/docs/docs/models/interior-m3.md`, "Pressure gradient"); default `lagrangeGradient`. */
  gradient?: { energy: number; breech: number } | undefined
  /** Heat loss to the bore, default none, omitted fields from `convectiveDefaults` (`apps/docs/docs/models/interior-leakage-heat.md`, "Convective heat loss"). */
  heat?:
    | undefined
    | { model: 'none' }
    | {
        model: 'convective'
        /** Flame temperature, K. */
        flameTemperature: number
        /** Wall temperature, K. */
        wallTemperature?: number | undefined
        /** Gas viscosity, Pa s. */
        viscosity?: number | undefined
        prandtl?: number | undefined
        /** Factor on the heat flux, default 1. */
        factor?: number | undefined
      }
  /** Gas leakage past the projectile (`apps/docs/docs/models/interior-leakage-heat.md`); default none. */
  leakage?:
    | {
        /** Leak area over travel, m and m2, interpolated linearly, 0 outside; while held the area at travel 0 applies (0 unless a point is at travel 0). */
        area: readonly { travel: number; area: number }[]
        /** Pressure ahead of the projectile, Pa; default the ICAO sea-level pressure. */
        backPressure?: number | undefined
        /** Discharge coefficient on the area, default 1. */
        discharge?: number | undefined
      }
    | undefined
}

/** Defaults of the convective heat model (`apps/docs/docs/models/interior-leakage-heat.md`, "Convective heat loss"): K, Pa s, 1. */
export const convectiveDefaults = { wallTemperature: 300, viscosity: 6e-5, prandtl: 0.69 }

/** Quasi-steady isentropic orifice flow at pressure ratio p_a / p_0: psi_k when choked, the subsonic factor above the critical ratio, 0 from ratio 1 (`apps/docs/docs/models/interior-leakage-heat.md`, "Flow through the leak"). */
export function leakFlowFactor(gamma: number, ratio: number): number {
  const k = gamma
  if (!(ratio < 1)) return 0
  if (ratio <= (2 / (k + 1)) ** (k / (k - 1)))
    return Math.sqrt(k) * (2 / (k + 1)) ** ((k + 1) / (2 * (k - 1)))
  return Math.sqrt(((2 * k) / (k - 1)) * (ratio ** (2 / k) - ratio ** ((k + 1) / k)))
}

/** Lagrange gradient: gas kinetic energy m_c v^2 / 6, breech pressure p_b (1 + m_c / (2 m_p)). */
const lagrangeGradient: { energy: number; breech: number } = { energy: 1 / 3, breech: 1 / 2 }

/** Integrator tolerances and limits of `interior` and `closedVessel`. */
export interface InteriorOptions {
  /** Relative error tolerance of the integrator. */
  relativeTolerance: number
  /** Absolute tolerance on the scaled state (`apps/docs/docs/models/interior-m3.md`, "Scaled state and integration"). */
  absoluteTolerance: number
  /** Spacing of curve points and largest step, s. */
  outputStep: number
  /** Accepted plus rejected integrator steps before the run is invalid (`integration`). */
  maxSteps: number
  /** Run time from ignition at which the run is invalid (`maxTime`), s. */
  maxTime: number
}

/** Defaults of `InteriorOptions`; options passed to `interior` override them by field. */
export const interiorDefaults: InteriorOptions = {
  relativeTolerance: 1e-9,
  absoluteTolerance: 1e-11,
  outputStep: 2e-6,
  maxSteps: 2e5,
  maxTime: 0.1,
}

/** One point of the pressure curve. */
export interface InteriorPoint {
  /** Time from ignition, s. */
  time: number
  /** Projectile travel from the seated position, m. */
  travel: number
  /** Projectile velocity, m/s. */
  velocity: number
  /** Burnt fraction of the charge. */
  burntFraction: number
  /** Space-mean gas pressure, Pa. */
  meanPressure: number
  /** Pressure at the projectile base, Pa. */
  basePressure: number
  /** Pressure at the breech, Pa. */
  breechPressure: number
  /** K; null without a heat model, which defines the gas constant. */
  gasTemperature: number | null
  /** Gas mass lost through the leak, kg; present only with `leakage`. */
  leakedMass?: number
}

/** Energy split at the muzzle, J; the terms add up to m_c Q z. */
export interface InteriorEnergy {
  /** Internal energy of the gas left in the bore. */
  gas: number
  /** Kinetic energy of the projectile's translation. */
  translation: number
  /** Kinetic energy of the projectile's rotation. */
  rotation: number
  /** Kinetic energy of the gas behind the projectile. */
  gasKinetic: number
  /** Work done against bore resistance. */
  resistance: number
  /** Heat lost to the bore wall; 0 without a heat model. */
  heat: number
  /** Enthalpy carried out by leaking gas; 0 without leakage. */
  leakage: number
}

/** `input` (see `field`), solid volume or gas covolume not below the chamber volume, burnout before the projectile moves, projectile velocity back to 0, integrator failure (step size or `maxSteps`), or `maxTime` reached before the muzzle (`apps/docs/docs/models/interior-m3.md`, "Limits"). */
export type InteriorReason =
  | 'input'
  | 'chamberVolume'
  | 'noShotStart'
  | 'stuck'
  | 'integration'
  | 'maxTime'

/** An invalid run; `field` names the first invalid input field with reason `input`. */
export type InteriorInvalid = { valid: false; reason: InteriorReason; field?: string }

/** A valid run of `interior`: the curve and the muzzle values. */
export interface InteriorRun {
  valid: true
  points: InteriorPoint[]
  /** Peak breech pressure, Pa. */
  peakBreechPressure: number
  /** Time of the peak breech pressure, s from ignition. */
  maxPressureTime: number
  /** Projectile travel at the peak breech pressure, m. */
  maxPressureTravel: number
  /** Peak base pressure, Pa. */
  maxBasePressure: number
  /** Peak mean pressure, Pa. */
  maxMeanPressure: number
  /** Projectile velocity at muzzle exit, m/s. */
  muzzleVelocity: number
  /** Time of muzzle exit, s from ignition. */
  muzzleTime: number
  /** Mean pressure at muzzle exit, Pa. */
  muzzleMeanPressure: number
  /** Base pressure at muzzle exit, Pa. */
  muzzleBasePressure: number
  /** Breech pressure at muzzle exit, Pa. */
  muzzleBreechPressure: number
  /** s from ignition. */
  shotStartTime: number
  /** muzzleTime - shotStartTime, s; from shot start. */
  barrelTime: number
  /** Time (s from ignition) and projectile travel (m) at burnout; null when the charge is still burning at the muzzle. */
  burnout: { time: number; travel: number } | null
  /** Burnt fraction of the charge at muzzle exit. */
  muzzleBurntFraction: number
  /** 1/2 m_p v^2 at the muzzle, J. */
  muzzleEnergy: number
  /** muzzleEnergy over m_c Q. */
  efficiency: number
  /** Energy split at the muzzle. */
  energy: InteriorEnergy
  /** Last time before the peak with breech pressure 0.1 peakBreechPressure, s; 0 when the start is above it. */
  tenPercentPressureTime: number
  /** Integrator steps of the run. */
  steps: number
}

/** Result of `interior`: the curve and the muzzle values, or `InteriorInvalid`. */
export type InteriorResult = InteriorInvalid | InteriorRun

/** Result of `closedVessel`: the curve to burnout, or `InteriorInvalid`. */
export type ClosedVesselResult =
  | InteriorInvalid
  | {
      valid: true
      /** Curve points from ignition to burnout. */
      points: InteriorPoint[]
      /** Time of the last point, s from ignition. */
      burnoutTime: number
      /** Mean pressure at the last point, Pa. */
      finalPressure: number
      /** Accepted plus rejected integrator steps. */
      steps: number
    }

const pos = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v > 0
const nonNeg = (v: number | undefined) => v !== undefined && Number.isFinite(v) && v >= 0

/** Specific energy at the propellant temperature, J/kg: the input scaled by `energyTemperature`. */
function energyAtTemperature(load: InteriorLoad): number {
  const { specificEnergy, energyTemperature, temperatureSensitivity: t } = load.propellant
  return t === undefined || !energyTemperature
    ? specificEnergy
    : specificEnergy * Math.exp(energyTemperature * (load.propellantTemperature - t.reference))
}

type Check = [string, boolean]

/** Checks of the chamber, barrel, bullet, charge and propellant. */
function bodyChecks(load: InteriorLoad): Check[] {
  const { chamber, barrel, bullet, propellant } = load
  const t = propellant.temperatureSensitivity
  return [
    ['chamber.volume', pos(chamber.volume)],
    ['chamber.throatWear', chamber.throatWear === undefined || nonNeg(chamber.throatWear)],
    ['chamber.boreArea', pos(chamber.boreArea)],
    ['chamber.boreDiameter', pos(chamber.boreDiameter)],
    ['barrel.length', pos(barrel.length)],
    ['barrel.twist', nonNeg(barrel.twist)],
    ['bullet.mass', pos(bullet.mass)],
    ['bullet.gyrationRadius', bullet.gyrationRadius === undefined || pos(bullet.gyrationRadius)],
    ['charge', pos(load.charge)],
    ['propellant.specificEnergy', pos(propellant.specificEnergy)],
    ['propellant.gamma', Number.isFinite(propellant.gamma) && propellant.gamma > 1],
    ['propellant.density', pos(propellant.density)],
    ['propellant.covolume', nonNeg(propellant.covolume)],
    [
      'propellant.temperatureSensitivity',
      t === undefined || (pos(t.reference) && Number.isFinite(t.cold) && Number.isFinite(t.hot)),
    ],
    [
      'propellant.energyTemperature',
      propellant.energyTemperature === undefined ||
        propellant.energyTemperature === 0 ||
        (Number.isFinite(propellant.energyTemperature) && t !== undefined),
    ],
    ['propellantTemperature', pos(load.propellantTemperature)],
    ['ignitionPressure', pos(load.ignitionPressure)],
    ['startPressure', nonNeg(load.startPressure)],
  ]
}

/** Whether an engraving profile has travels and pressures of at least 0, with rising travels. */
const engravingValid = (profile: readonly { travel: number; pressure: number }[]) =>
  profile.every(
    (p, i) =>
      nonNeg(p.travel) && nonNeg(p.pressure) && (i === 0 || p.travel > nth(profile, i - 1).travel),
  )

/** None, or a positive flame temperature with positive wall temperature, viscosity and Prandtl number where given and a factor of at least 0. */
function heatValid(heat: InteriorLoad['heat']): boolean {
  if (heat === undefined || heat.model === 'none') return true
  return (
    pos(heat.flameTemperature) &&
    [heat.wallTemperature, heat.viscosity, heat.prandtl].every((v) => v === undefined || pos(v)) &&
    (heat.factor === undefined || nonNeg(heat.factor))
  )
}

/** Checks of the bullet's resistance, the chamber area, the gas gradient and the heat loss. */
function resistanceChecks(load: InteriorLoad): Check[] {
  const { resistance, chamber, gradient, heat } = load
  return [
    ['resistance.friction', resistance?.friction === undefined || nonNeg(resistance.friction)],
    ['resistance.engraving', engravingValid(resistance?.engraving ?? [])],
    [
      'chamber.area',
      chamber.area === undefined ||
        (Number.isFinite(chamber.area) && chamber.area >= chamber.boreArea),
    ],
    // the chambrage form exists for the Lagrange coefficients only
    [
      'gradient',
      gradient === undefined ||
        (chamber.area === undefined && nonNeg(gradient.energy) && nonNeg(gradient.breech)),
    ],
    ['heat', heatValid(heat)],
  ]
}

/** Checks of the gas leakage. */
function leakageChecks({ leakage }: InteriorLoad): Check[] {
  const leak = leakage?.area ?? []
  return [
    [
      'leakage.area',
      leakage === undefined ||
        (leak.length > 0 &&
          leak.every(
            (p, i) =>
              nonNeg(p.travel) && nonNeg(p.area) && (i === 0 || p.travel > nth(leak, i - 1).travel),
          )),
    ],
    ['leakage.backPressure', leakage?.backPressure === undefined || nonNeg(leakage.backPressure)],
    ['leakage.discharge', leakage?.discharge === undefined || nonNeg(leakage.discharge)],
  ]
}

/** Name of the first invalid input field, or undefined (`apps/docs/docs/models/interior-m3.md`, "Limits"). */
function inputError(load: InteriorLoad): string | undefined {
  const checks = [...bodyChecks(load), ...resistanceChecks(load), ...leakageChecks(load)]
  for (const [field, ok] of checks) if (!ok) return field
  return burnError(load.propellant.burn)
}

type EventKind = 'start' | 'break' | 'burnout' | 'profile' | 'muzzle' | 'stall' | 'peak' | 'onset'

interface Run {
  points: InteriorPoint[]
  shotStartTime: number
  burnout: { time: number; travel: number } | null
  steps: number
  energy: InteriorEnergy
}

/** The burn-law coefficient at the propellant temperature: of the web for a geometric burn, of the reference pressure for vivacity. */
function burnCoefficient(load: InteriorLoad, form: ReturnType<typeof burnForm>): number {
  const { burn, temperatureSensitivity: tc } = load.propellant
  const dT = load.propellantTemperature - (tc?.reference ?? 0)
  const tauT = tc === undefined ? 1 : Math.exp((dT >= 0 ? tc.hot : tc.cold) * dT)
  const n = burn.exponent
  return burn.kind === 'geometric'
    ? (burn.coefficient * tauT) / form.halfWeb
    : (burn.vivacity * tauT) / burn.referencePressure ** n
}

/** The chambrage gradient over travel x with g = 1 - (A / A_chamber)^2 and f = V_0 / V (V_0 without throat wear), null without `chamber.area` (`apps/docs/docs/models/interior-m3.md`, "Chambrage"). */
function chambrageOf(load: InteriorLoad, vc: number, mpr: number) {
  const { area: chamberArea, boreArea: area, volume: caseVolume } = load.chamber
  if (chamberArea === undefined) return null
  const mc = load.charge
  const g = 1 - (area / chamberArea) ** 2
  // a worn throat counts as bore: the step into the bore sits at the case volume
  const f = (x: number) => caseVolume / (vc + area * x)
  const delta = (x: number) => (1 - g * f(x) ** 3) / 3
  const eps = (x: number) => (1 - g * f(x) ** 2) / 2
  const me = (x: number) => mpr + delta(x) * mc
  /** Acceleration, base and breech pressure at mean pressure p, resistance force fr, travel x and velocity v. */
  const motion = (p: number, fr: number, x: number, v: number) => {
    const volume = vc + area * x
    // (1/2) m_c (d delta / dx) v^2: the inertia grows as gas moves from the chamber into the bore
    const a = (area * p - fr - 0.5 * mc * g * f(x) ** 3 * (area / volume) * v * v) / me(x)
    const base = (mpr * a + fr) / area
    // the gas speeds up at the step into the bore: a Bernoulli drop behind the base
    const breech = base + (eps(x) * mc * a) / area + 0.5 * (mc / volume) * g * f(x) ** 2 * v * v
    return { a, base, breech }
  }
  return { delta, me, motion }
}

/** Effective mass, burn-law coefficient, reference velocity vr and time ts; `chamberVolume` when solid or covolume fill the chamber (`apps/docs/docs/models/interior-m3.md`, "Scaled state and integration"). */
function scaleInteriorLoad(load: InteriorLoad) {
  const { chamber, barrel, bullet, propellant } = load
  const vc = wornVolume(chamber.volume, chamber.boreArea, chamber.throatWear ?? 0)
  const area = chamber.boreArea
  const d = chamber.boreDiameter
  const xe = barrel.length
  const mp = bullet.mass
  const mc = load.charge
  const k = propellant.gamma
  const eta = propellant.covolume
  const solid = mc / propellant.density
  const e0 = mc * energyAtTemperature(load)
  // the charge sits in the case: a worn throat adds gas volume, not room for the powder
  if (!(chamber.volume - solid > 0) || !(chamber.volume - eta * mc > 0))
    return { valid: false, reason: 'chamberVolume' } as InteriorInvalid

  // effective mass with rotation and gas kinetic energy
  const rg = bullet.gyrationRadius ?? d / (2 * Math.SQRT2)
  const mpr = barrel.twist > 0 ? mp * (1 + ((2 * Math.PI * rg) / barrel.twist) ** 2) : mp
  const { energy: delta, breech: eps } = load.gradient ?? lagrangeGradient
  const me = mpr + delta * mc

  const form = burnForm(propellant.burn)
  const n = propellant.burn.exponent
  const coef = burnCoefficient(load, form)

  // scaled state [f, x/xe, v/vr, Wr/E0, Eh/E0], with leakage also [ml/mc, El/E0], and time tau = t / ts
  const vr = Math.sqrt((2 * e0) / mp)
  const ts = xe / vr
  return {
    vc,
    area,
    d,
    xe,
    mp,
    mc,
    k,
    eta,
    solid,
    e0,
    mpr,
    delta,
    eps,
    me,
    form,
    n,
    coef,
    vr,
    ts,
    chambrage: chambrageOf(load, vc, mpr),
  }
}

type Scaling = Exclude<ReturnType<typeof scaleInteriorLoad>, InteriorInvalid>

/** Flags and indices of a run that change at its events. */
interface Phase {
  moving: boolean
  burning: boolean
  leaking: boolean
  /** Next form-function break and resistance or leak kink to watch. */
  breakIndex: number
  profileIndex: number
}

/** Linear interpolation over travel, 0 before the first and after the last point. */
const profileAt = <T extends { travel: number }>(
  pts: readonly T[],
  value: (pt: T) => number,
  x: number,
) => {
  const i = pts.findIndex((pt) => pt.travel >= x)
  if (i < 0 || x < nth(pts, 0).travel) return 0
  if (i === 0) return value(nth(pts, 0))
  const a = nth(pts, i - 1)
  const b = nth(pts, i)
  return value(a) + ((x - a.travel) * (value(b) - value(a))) / (b.travel - a.travel)
}

/** The bore resistance force at travel x: the friction plus the engraving pressure there, times the bore area. */
function resistanceForce(load: InteriorLoad, area: number) {
  const friction = load.resistance?.friction ?? 0
  const profile = load.resistance?.engraving ?? []
  return (x: number) => area * (friction + profileAt(profile, (pt) => pt.pressure, x))
}

/** Whether it leaks, the leak area over travel, back pressure, discharge coefficient and the charge mass lost at a state (`apps/docs/docs/models/interior-leakage-heat.md`). */
function leakageOf(load: InteriorLoad, mc: number) {
  const leak = load.leakage !== undefined
  return {
    leak,
    leakPoints: load.leakage?.area ?? [],
    pa: load.leakage?.backPressure ?? icao.pressure,
    cd: load.leakage?.discharge ?? 1,
    lostMass: (y: Float64Array) => (leak ? el(y, 5) * mc : 0),
  }
}

type Leakage = ReturnType<typeof leakageOf>

/** Travels before the muzzle `xe` where resistance or leak area has a kink, rising; a point at the muzzle would fire before the muzzle event and hide it. */
const kinksBefore = (points: readonly { travel: number }[], xe: number) =>
  [...new Set(points.map((pt) => pt.travel))].filter((x) => x < xe).toSorted((a, b) => a - b)

/** The gas constant of a convective heat loss, 0 for none. */
function gasConstantOf(load: InteriorLoad, k: number) {
  const heat = load.heat ?? { model: 'none' }
  return heat.model === 'convective'
    ? ((k - 1) * load.propellant.specificEnergy) / heat.flameTemperature
    : 0
}

/** The free volume behind the bullet, the mean pressure and the gas temperature of a scaled state. */
function gasOf(s: Scaling, { leak, lostMass }: Leakage, gasR: number) {
  const { vc, area, xe, mc, k, eta, solid, e0, form, vr, chambrage } = s
  // the leak terms are separate summands, exactly 0 without leakage, so those results stay bit-identical
  const freeVolume = (z: number, x: number, lost: number) =>
    vc + area * x - solid * (1 - z) - eta * mc * z + eta * lost
  const pressure = (y: Float64Array) => {
    const z = form.z(el(y, 0))
    const v = el(y, 2) * vr
    const leaked = leak ? el(y, 6) : 0
    const me = chambrage ? chambrage.me(el(y, 1) * xe) : s.me
    return (
      ((k - 1) * (e0 * (z - el(y, 3) - el(y, 4) - leaked) - 0.5 * me * v * v)) /
      freeVolume(z, el(y, 1) * xe, lostMass(y))
    )
  }
  const temperature = (y: Float64Array, p: number) => {
    const z = form.z(el(y, 0))
    const lost = lostMass(y)
    const gas = mc * z - lost
    return gasR > 0 && gas > 0 ? (p * freeVolume(z, el(y, 1) * xe, lost)) / (gas * gasR) : null
  }
  return { freeVolume, pressure, temperature }
}

type FreeVolume = (z: number, x: number, lost: number) => number

/** The convective heat flux to the barrel wall at a scaled state and mean pressure, 0 without convective heat loss. */
function heatFluxOf(
  load: InteriorLoad,
  s: Scaling,
  lostMass: Leakage['lostMass'],
  freeVolume: FreeVolume,
) {
  const { vc, area, d, xe, mc, k, solid, form, vr } = s
  const heat = load.heat ?? { model: 'none' }
  const gasR = gasConstantOf(load, k)
  return (y: Float64Array, p: number) => {
    if (heat.model !== 'convective') return 0
    const z = form.z(el(y, 0))
    const v = el(y, 2) * vr
    const lost = lostMass(y)
    if (!(v > 0) || z < 1e-9 || !(mc * z - lost > 0)) return 0
    const x = el(y, 1) * xe
    const mu = heat.viscosity ?? convectiveDefaults.viscosity
    const prandtl = heat.prandtl ?? convectiveDefaults.prandtl
    const tw = heat.wallTemperature ?? convectiveDefaults.wallTemperature
    const gas = (p * freeVolume(z, x, lost)) / ((mc * z - lost) * gasR)
    const density = (mc * z - lost) / (vc + area * x - solid * (1 - z))
    const re = (density * (v / 2) * d) / mu
    const conductivity = (mu * ((k * gasR) / (k - 1))) / prandtl
    // Prandtl exponent 0.3 when the gas is cooled by the wall, 0.4 when it is heated
    const pr = prandtl ** (gas > tw ? 0.3 : 0.4)
    const h = ((0.023 * conductivity) / d) * re ** 0.8 * pr
    return (heat.factor ?? 1) * h * Math.PI * d * (x + vc / area) * (gas - tw)
  }
}

/** Base pressure from mean pressure and resistance force while moving (`apps/docs/docs/models/interior-m3.md`, "Pressure gradient"). */
const basePressureOf =
  ({ area, mc, mpr, delta }: Scaling) =>
  (p: number, fr: number) =>
    (p + (delta * mc * fr) / (area * mpr)) / (1 + (delta * mc) / mpr)

/** Writes the scaled leak mass and enthalpy rates into el(dy, 5), el(dy, 6) (`apps/docs/docs/models/interior-leakage-heat.md`, "Flow through the leak" and "Energy carried out"). */
function leakRatesOf(s: Scaling, leakage: Leakage, freeVolume: FreeVolume, phase: Phase) {
  const { xe, mc, k, eta, e0, form, ts } = s
  const { leakPoints, pa, cd, lostMass } = leakage
  return (y: Float64Array, p: number, pb: number, dy: Float64Array) => {
    dy[5] = 0
    dy[6] = 0
    const z = form.z(el(y, 0))
    const lost = lostMass(y)
    const gas = mc * z - lost
    if (!phase.leaking || !(gas > 0) || !(p > 0) || !(pb > pa)) return
    const x = el(y, 1) * xe
    const rt = (p * freeVolume(z, x, lost)) / gas
    const flow =
      (cd * profileAt(leakPoints, (pt) => pt.area, x) * pb * leakFlowFactor(k, pa / pb)) /
      Math.sqrt(rt)
    dy[5] = (flow * ts) / mc
    dy[6] = (flow * ((k * rt) / (k - 1) + eta * p) * ts) / e0
  }
}

/** Mean, base and breech pressure of a scaled state, equal while the projectile is at rest (`apps/docs/docs/models/interior-m3.md`, "Pressure gradient"). */
function pressuresOf(
  s: Scaling,
  phase: Phase,
  f: {
    pressure: (y: Float64Array) => number
    resistance: (x: number) => number
    basePressure: (p: number, fr: number) => number
  },
) {
  const { area, xe, mc, eps, me, vr, chambrage } = s
  return (y: Float64Array): [number, number, number] => {
    const p = f.pressure(y)
    if (!phase.moving) return [p, p, p]
    const fr = f.resistance(el(y, 1) * xe)
    if (chambrage) {
      const { base, breech } = chambrage.motion(p, fr, el(y, 1) * xe, el(y, 2) * vr)
      return [p, base, breech]
    }
    const pb = f.basePressure(p, fr)
    return [p, pb, pb + (eps * mc * ((area * p - fr) / me)) / area]
  }
}

/** Bore resistance, leakage, pressure, temperature, heat flux, base and breech pressure, and the leak rates of the scaled state. */
function gasState(load: InteriorLoad, s: Scaling, phase: Phase) {
  const { area, xe, mc, k } = s
  const resistance = resistanceForce(load, area)
  const leakage = leakageOf(load, mc)
  const kinks = kinksBefore([...(load.resistance?.engraving ?? []), ...leakage.leakPoints], xe)
  const { freeVolume, pressure, temperature } = gasOf(s, leakage, gasConstantOf(load, k))
  const heatFlux = heatFluxOf(load, s, leakage.lostMass, freeVolume)
  const basePressure = basePressureOf(s)
  const leakRates = leakRatesOf(s, leakage, freeVolume, phase)
  const pressures = pressuresOf(s, phase, { pressure, resistance, basePressure })
  // events
  const pst = load.startPressure
  /** Shot start function: positive once the pressure and the force on the base exceed their limits. */
  const startG = (y: Float64Array) => {
    const p = pressure(y)
    return Math.min(p - pst, area * p - resistance(el(y, 1) * xe))
  }
  return {
    resistance,
    leak: leakage.leak,
    pa: leakage.pa,
    lostMass: leakage.lostMass,
    kinks,
    freeVolume,
    pressure,
    temperature,
    heatFlux,
    basePressure,
    leakRates,
    pressures,
    startG,
  }
}

type Gas = ReturnType<typeof gasState>

/** Right-hand side of the scaled state (`apps/docs/docs/models/interior-m3.md`, "Scaled state and integration"). */
function interiorRhs(s: Scaling, gas: Gas, phase: Phase): Rhs {
  const { area, xe, e0, me, form, n, coef, vr, ts, chambrage } = s
  const { pressure, resistance, heatFlux, basePressure, leakRates, leak } = gas
  return (_t, y, dy) => {
    const p = pressure(y)
    dy[0] = phase.burning ? coef * Math.max(p, 0) ** n * form.phi(el(y, 0)) * ts : 0
    if (!phase.moving) {
      dy.fill(0, 1, 5)
      if (leak) leakRates(y, p, p, dy)
      return
    }
    const x = el(y, 1) * xe
    const v = el(y, 2) * vr
    const fr = resistance(x)
    const m = chambrage?.motion(p, fr, x, v)
    dy[1] = el(y, 2)
    dy[2] = m ? (m.a * ts) / vr : (((area * p - fr) / me) * ts) / vr
    dy[3] = (fr * v * ts) / e0
    dy[4] = (heatFlux(y, p) * ts) / e0
    if (leak) leakRates(y, p, m ? m.base : basePressure(p, fr), dy)
  }
}

/** The model of one run: its scales, gas state, phase and right-hand side. */
interface RunModel {
  s: Scaling
  gas: Gas
  phase: Phase
  rhs: Rhs
}

type AddEvent = (
  kind: EventKind,
  eventFunction: Rk45Event['eventFunction'],
  direction: -1 | 1,
  index?: number,
) => void

/** Central difference in tau; rk45 calls the three peak events with the same state, so the rates are kept for the last state, and a new list is made at each restart, when `moving` or `burning` may change. */
function peakSlopes({ gas, rhs }: RunModel, size: number) {
  const { pressures } = gas
  const fd = new Float64Array(size)
  const yp = new Float64Array(size)
  const ym = new Float64Array(size)
  return () => {
    const last = new Float64Array(size).fill(Number.NaN)
    const rates = [0, 0, 0]
    return (q: number) => (t: number, y: Float64Array) => {
      if (!last.every((v, i) => v === el(y, i))) {
        rhs(t, y, fd)
        const e = 1e-7
        for (let i = 0; i < y.length; i++) {
          yp[i] = el(y, i) + e * el(fd, i)
          ym[i] = el(y, i) - e * el(fd, i)
        }
        const pp = pressures(yp)
        const pm = pressures(ym)
        for (const [j, v] of pp.entries()) rates[j] = (v - nth(pm, j)) / (2 * e)
        last.set(y)
      }
      return nth(rates, q)
    }
  }
}

/** The events while the charge burns: the form-function breaks ahead of state y and the burnout. */
function addBurningEvents({ s, phase }: RunModel, add: AddEvent, y: Float64Array) {
  const { form } = s
  for (let i = phase.breakIndex; i < form.breaks.length; i++) {
    const edge = nth(form.breaks, i)
    if (edge > el(y, 0)) add('break', (_t, state) => el(state, 0) - edge, 1, i)
  }
  add('burnout', (_t, state) => el(state, 0) - form.end, 1)
}

/** The events while the bullet moves: the kinks ahead of state y, muzzle, stall and the three pressure peaks. */
function addMovingEvents(
  { s, gas, phase }: RunModel,
  add: AddEvent,
  y: Float64Array,
  slopes: ReturnType<typeof peakSlopes>,
) {
  const { xe } = s
  const { kinks } = gas
  for (let i = phase.profileIndex; i < kinks.length; i++) {
    const kink = nth(kinks, i)
    if (kink / xe > el(y, 1)) add('profile', (_t, state) => el(state, 1) - kink / xe, 1, i)
  }
  add('muzzle', (_t, state) => el(state, 1) - 1, 1)
  add('stall', (_t, state) => el(state, 2), -1)
  const slope = slopes()
  for (const q of [0, 1, 2]) add('peak', slope(q), -1)
}

/** From state y: shot start, form-function breaks, burnout, resistance and leak kinks, muzzle, stall, the three pressure peaks and the onset of leak flow. */
function interiorEvents(m: RunModel, size: number, closed: boolean) {
  const { phase } = m
  const { leak, pa, pressures, startG } = m.gas
  const slopes = peakSlopes(m, size)
  return (y: Float64Array) => {
    const list: { kind: EventKind; index: number; ev: Rk45Event }[] = []
    const add = (
      kind: EventKind,
      eventFunction: Rk45Event['eventFunction'],
      direction: -1 | 1,
      index = 0,
    ) => list.push({ kind, index, ev: { eventFunction, direction, terminal: kind !== 'peak' } })
    if (!phase.moving && !closed) add('start', (_t, state) => startG(state), 1)
    if (phase.burning) addBurningEvents(m, add, y)
    if (phase.moving) addMovingEvents(m, add, y, slopes)
    // onset of flow: the subsonic rate has an infinite slope at p_b = p_a
    if (leak && !phase.leaking) add('onset', (_t, state) => pressures(state)[1] - pa, 1)
    return list
  }
}

/** Energy split at the final state y (`InteriorEnergy`). */
function energyBalance(s: Scaling, gas: Gas, y: Float64Array): InteriorEnergy {
  const { xe, mp, mc, k, e0, mpr, form, vr, chambrage } = s
  const { pressure, freeVolume, lostMass, leak } = gas
  const p = pressure(y)
  const v = el(y, 2) * vr
  const delta = chambrage ? chambrage.delta(el(y, 1) * xe) : s.delta
  return {
    gas: (p * freeVolume(form.z(el(y, 0)), el(y, 1) * xe, lostMass(y))) / (k - 1),
    translation: 0.5 * mp * v * v,
    rotation: 0.5 * (mpr - mp) * v * v,
    gasKinetic: 0.5 * delta * mc * v * v,
    resistance: el(y, 3) * e0,
    heat: el(y, 4) * e0,
    leakage: leak ? el(y, 6) * e0 : 0,
  }
}

/** Moves the phase past the event, a burnout also setting the burnt state at the end of the form function; true for a burnout. */
function applyEvent(
  { s, phase }: RunModel,
  { kind, index }: { kind: EventKind; index: number },
  y: Float64Array,
) {
  if (kind === 'start') phase.moving = true
  else if (kind === 'break') phase.breakIndex = index + 1
  else if (kind === 'profile') phase.profileIndex = index + 1
  else if (kind === 'onset') phase.leaking = true
  else if (kind === 'burnout') {
    phase.burning = false
    y[0] = s.form.end
  }
  return kind === 'burnout'
}

/** The state at ignition: the burnt fraction that gives the ignition pressure in the closed chamber. */
function ignitionState(
  load: InteriorLoad,
  s: Scaling,
  leak: boolean,
): Float64Array | InteriorInvalid {
  const { vc, mc, k, eta, solid, e0, form } = s
  const pi = load.ignitionPressure
  const z0 = (pi * (vc - solid)) / ((k - 1) * e0 - pi * mc * (1 / load.propellant.density - eta))
  if (!(z0 > 0 && z0 < 1)) return { valid: false, reason: 'input', field: 'ignitionPressure' }
  const y = new Float64Array(leak ? 7 : 5)
  y[0] = bisect((f) => form.z(f) < z0, [0, form.end], 200, false)
  return y
}

/** One integration to the next terminal event or `until.maxTime`; a step failure invalidates the run. */
function integrate(
  problem: Rk45Problem,
  options: InteriorOptions,
  until: Pick<Rk45Options, 'stepsBefore' | 'maxTime' | 'initialStep'>,
): ReturnType<typeof rk45> | InteriorInvalid {
  try {
    return rk45(problem, {
      relativeTolerance: options.relativeTolerance,
      absoluteTolerance: options.absoluteTolerance,
      maxSteps: options.maxSteps,
      ...until,
    })
  } catch (err) {
    if (err instanceof InputError) return { valid: false, reason: 'integration' }
    throw err
  }
}

/** What the driver carries from one integration to the next. */
interface RunState {
  tau: number
  y: Float64Array
  h: number | undefined
  steps: number
  /** End of the current output chunk, in tau. */
  next: number
  shotStartTime: number
  burnout: Run['burnout']
  points: InteriorPoint[]
}

/** What the driver needs to restart an integration. */
interface Driver extends RunModel {
  events: ReturnType<typeof interiorEvents>
  point: (tau: number, y: Float64Array) => InteriorPoint
  options: InteriorOptions
  closed: boolean
  tauMax: number
  dTau: number
}

/** The run after the integration reached an event: its phase change, and whether the run ends. */
function handleEvent(
  d: Driver,
  st: RunState,
  { kind, index }: { kind: EventKind; index: number },
): InteriorInvalid | 'continue' | 'done' {
  const { tau, y } = st
  const { ts, xe } = d.s
  if (kind === 'stall') return { valid: false, reason: 'stuck' }
  if (kind === 'start') st.shotStartTime = tau * ts
  if (kind === 'burnout') st.burnout = { time: tau * ts, travel: el(y, 1) * xe }
  if (applyEvent(d, { kind, index }, y) && !d.phase.moving && !d.closed)
    return { valid: false, reason: 'noShotStart' }
  st.points.push(d.point(tau, y))
  return kind === 'muzzle' || (d.closed && kind === 'burnout') ? 'done' : 'continue'
}

/** One integration from the state of `st` to the next event or output step. */
function advance(d: Driver, st: RunState): InteriorInvalid | 'continue' | 'done' {
  const { leak, pa, pressures } = d.gas
  // flow at or above p_a at the start or after a restart, where the rising onset event cannot fire
  if (leak && !d.phase.leaking && pressures(st.y)[1] >= pa) d.phase.leaking = true
  const list = d.events(st.y)
  const r = integrate(
    { f: d.rhs, t0: st.tau, y0: st.y, events: list.map((e) => e.ev) },
    d.options,
    { stepsBefore: st.steps, maxTime: Math.min(st.next, d.tauMax), initialStep: st.h },
  )
  if ('valid' in r) return r
  st.steps += r.steps
  st.h = r.h
  for (const hit of r.hits) st.points.push(d.point(hit.t, hit.y))
  st.tau = r.t
  st.y = r.y
  if (r.event !== null) return handleEvent(d, st, nth(list, r.event))
  st.points.push(d.point(st.tau, st.y))
  if (st.tau >= d.tauMax) return { valid: false, reason: 'maxTime' }
  st.next += d.dTau
  return 'continue'
}

/** Advances the run from `st` until the muzzle (closed vessel: burnout) or an invalid state. */
function drive(d: Driver, st: RunState): Run | InteriorInvalid {
  for (;;) {
    const outcome = advance(d, st)
    if (outcome === 'done') break
    if (outcome !== 'continue') return outcome
  }
  const { points, shotStartTime, burnout, steps, y } = st
  return { points, shotStartTime, burnout, steps, energy: energyBalance(d.s, d.gas, y) }
}

/** The output point of a scaled state at scaled time tau. */
function pointOf(s: Scaling, gas: Gas) {
  const { xe, form, vr, ts } = s
  const { leak, lostMass, temperature, pressures } = gas
  return (tau: number, y: Float64Array): InteriorPoint => {
    const [p, pb, pbr] = pressures(y)
    const pt: InteriorPoint = {
      time: tau * ts,
      travel: el(y, 1) * xe,
      velocity: el(y, 2) * vr,
      burntFraction: form.z(el(y, 0)),
      meanPressure: p,
      basePressure: pb,
      breechPressure: pbr,
      gasTemperature: temperature(y, p),
    }
    if (leak) pt.leakedMass = lostMass(y)
    return pt
  }
}

/** From ignition in chunks of `outputStep`, restarted at every terminal event, until the muzzle (closed vessel: burnout). */
function runInterior(
  load: InteriorLoad,
  options: InteriorOptions,
  closed: boolean,
  s: Scaling,
): Run | InteriorInvalid {
  const { ts } = s
  const phase: Phase = {
    moving: false,
    burning: true,
    leaking: false,
    breakIndex: 0,
    profileIndex: 0,
  }
  const gas = gasState(load, s, phase)
  const rhs = interiorRhs(s, gas, phase)
  const point = pointOf(s, gas)

  const start = ignitionState(load, s, gas.leak)
  if ('valid' in start) return start
  const events = interiorEvents({ s, gas, phase, rhs }, start.length, closed)
  const first = point(0, start)
  if (!closed && gas.startG(start) >= 0) phase.moving = true
  const dTau = options.outputStep / ts
  const st: RunState = {
    tau: 0,
    y: start,
    h: undefined,
    steps: 0,
    next: dTau,
    shotStartTime: 0,
    burnout: null,
    points: [first],
  }
  const driver: Driver = {
    s,
    gas,
    phase,
    rhs,
    events,
    point,
    options,
    closed,
    tauMax: options.maxTime / ts,
    dTau,
  }
  return drive(driver, st)
}

const isOptionKey = (key: string): key is keyof InteriorOptions => key in interiorDefaults

function simulate(
  load: InteriorLoad,
  options: Settings<InteriorOptions>,
  closed: boolean,
): Run | InteriorInvalid {
  const merged = overlay(interiorDefaults, options)
  // an output step of 0 never advances the run
  const option = Object.keys(interiorDefaults)
    .filter(isOptionKey)
    .find((k) => !(Number.isFinite(merged[k]) && merged[k] > 0))
  if (option) return { valid: false, reason: 'input', field: option }
  const field = inputError(load)
  if (field) return { valid: false, reason: 'input', field }
  const s = scaleInteriorLoad(load)
  if ('valid' in s) return s
  return runInterior(load, merged, closed, s)
}

const peak = (points: InteriorPoint[], key: 'meanPressure' | 'basePressure' | 'breechPressure') =>
  points.reduce((best, pt) => (pt[key] > best[key] ? pt : best), nth(points, 0))

/** Peak mean pressure over the hold pressure, max(start pressure, ignition pressure), below which the charge is too small for the model (`apps/docs/docs/models/interior-m3.md`, "Limits"). */
export const chargeTooSmallRatio = 2.2

/** The peak mean pressure below `chargeTooSmallRatio` times the larger of the start and the ignition pressure, Pa (`apps/docs/docs/models/interior-m3.md`, "Limits"). */
export function chargeTooSmall(
  peakMeanPressure: number,
  startPressure: number,
  ignitionPressure: number,
): boolean {
  return !(peakMeanPressure >= chargeTooSmallRatio * Math.max(startPressure, ignitionPressure))
}

/** Runs the interior model on one load until muzzle exit. */
export function interior(
  load: InteriorLoad,
  options: Settings<InteriorOptions> = {},
): InteriorResult {
  const run = simulate(load, options, false)
  if ('valid' in run) return run
  const { points } = run
  const last = nth(points, points.length - 1)
  const top = peak(points, 'breechPressure')
  const imax = points.indexOf(top)
  const threshold = 0.1 * top.breechPressure
  let tenPercentPressureTime = 0
  if (nth(points, 0).breechPressure < threshold) {
    let j = imax
    while (nth(points, j).breechPressure > threshold) j--
    const a = nth(points, j)
    const b = nth(points, j + 1)
    tenPercentPressureTime =
      a.time +
      ((threshold - a.breechPressure) * (b.time - a.time)) / (b.breechPressure - a.breechPressure)
  }
  const muzzleEnergy = 0.5 * load.bullet.mass * last.velocity ** 2
  return {
    valid: true,
    points,
    peakBreechPressure: top.breechPressure,
    maxPressureTime: top.time,
    maxPressureTravel: top.travel,
    maxBasePressure: peak(points, 'basePressure').basePressure,
    maxMeanPressure: peak(points, 'meanPressure').meanPressure,
    muzzleVelocity: last.velocity,
    muzzleTime: last.time,
    muzzleMeanPressure: last.meanPressure,
    muzzleBasePressure: last.basePressure,
    muzzleBreechPressure: last.breechPressure,
    shotStartTime: run.shotStartTime,
    barrelTime: last.time - run.shotStartTime,
    burnout: run.burnout,
    muzzleBurntFraction: last.burntFraction,
    muzzleEnergy,
    efficiency: muzzleEnergy / (load.charge * energyAtTemperature(load)),
    energy: run.energy,
    tenPercentPressureTime,
    steps: run.steps,
  }
}

/** Burns the charge in the closed chamber (projectile held) until burnout. */
export function closedVessel(
  load: InteriorLoad,
  options: Settings<InteriorOptions> = {},
): ClosedVesselResult {
  const run = simulate(load, options, true)
  if ('valid' in run) return run
  const last = nth(run.points, run.points.length - 1)
  return {
    valid: true,
    points: run.points,
    burnoutTime: last.time,
    finalPressure: last.meanPressure,
    steps: run.steps,
  }
}
