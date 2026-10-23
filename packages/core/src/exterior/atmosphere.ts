/**
 * Atmosphere for the exterior model, described in `apps/docs/docs/models/exterior-atmosphere.md`.
 * SI throughout: altitude m, pressure Pa (absolute station pressure), temperature K, humidity 0..1.
 */
import { InputError } from '../errors.ts'

/** Air at one point: altitude above mean sea level, station pressure, temperature, humidity. */
export interface Air {
  /** Altitude above mean sea level, m. */
  altitude: number
  /** Absolute station pressure, Pa (not reduced to sea level). */
  pressure: number
  /** Temperature, K. */
  temperature: number
  /** Relative humidity, fraction 0..1. */
  humidity: number
}

/** Defining constants of the ICAO standard atmosphere (ICAO Doc 7488/3). */
export interface IcaoConstants {
  /** Sea-level temperature, K. */
  temperature: 288.15
  /** Sea-level pressure, Pa. */
  pressure: 101325
  /** Temperature lapse rate in the troposphere, K/m. */
  lapseRate: 0.0065
  /** Specific gas constant of dry air, J/(kg K). */
  gasConstant: 287.05287
  /** Standard gravity, m/s2. */
  gravity: 9.80665
  /** Ratio of specific heats of dry air. */
  gamma: 1.4
  /** Tropopause altitude, m; the model has only the tropospheric layer. */
  tropopause: 11000
}

/** The constants of {@link IcaoConstants}. */
export const icao: Readonly<IcaoConstants> = {
  temperature: 288.15,
  pressure: 101325,
  lapseRate: 0.0065,
  gasConstant: 287.05287,
  gravity: 9.80665,
  gamma: 1.4,
  tropopause: 11000,
}

/** Lowest altitude the model accepts, m. */
export const minAltitude = -5000

/** Universal gas constant of the ICAO atmosphere, J/(mol K). */
const universalGas = 8.31432
/** Molar mass of water vapour, kg/mol. */
const vapourMolarMass = 0.01801528
/** Specific gas constant of water vapour, J/(kg K). */
const vapourGas = universalGas / vapourMolarMass
/** Molar mass of water vapour over that of dry air. */
const vapourRatio = vapourMolarMass / (universalGas / icao.gasConstant)
/** Exponent of the tropospheric pressure law, g0 / (Rd L). */
const pressureExponent = icao.gravity / (icao.gasConstant * icao.lapseRate)

/** Saturation vapour pressure over water, Pa, Magnus form of WMO-No. 8 (temperature in K). */
export function saturationVapourPressure(temperature: number): number {
  const t = temperature - 273.15
  return 611.2 * Math.exp((17.62 * t) / (243.12 + t))
}

/** ICAO standard atmosphere at a (geopotential) altitude in m, with an optional humidity. */
export function standardAtmosphere(altitude: number, humidity = 0): Air {
  // checkAir rejects an altitude outside the troposphere
  const temperature = icao.temperature - icao.lapseRate * altitude
  const pressure = icao.pressure * (temperature / icao.temperature) ** pressureExponent
  return checkAir({ altitude, pressure, temperature, humidity })
}

/**
 * Air at `height` m above a station: temperature falls at the ICAO lapse rate from the station
 * temperature, pressure follows hydrostatically, relative humidity is held
 * (`apps/docs/docs/models/exterior-atmosphere.md`, "Air along the trajectory").
 */
export function airAt(station: Air, height: number): Air {
  const temperature = station.temperature - icao.lapseRate * height
  return {
    altitude: station.altitude + height,
    pressure: station.pressure * (temperature / station.temperature) ** pressureExponent,
    temperature,
    humidity: station.humidity,
  }
}

/**
 * Density altitude, m: the altitude of the ICAO standard atmosphere that has the density of `air`
 * (`apps/docs/docs/models/exterior-atmosphere.md`, "Density altitude"). Its tropospheric law is
 * extended past the tropopause.
 */
export function densityAltitude(air: Air): number {
  const ratio = airDensity(air) / airDensity(standardAtmosphere(0))
  // density follows (T / T0) ** (n - 1) in the troposphere
  return (icao.temperature * (1 - ratio ** (1 / (pressureExponent - 1)))) / icao.lapseRate
}

/** Density of moist air as an ideal mixture of dry air and water vapour, kg/m3. */
export function airDensity(air: Air): number {
  const e = air.humidity * saturationVapourPressure(air.temperature)
  return (
    (air.pressure - e) / (icao.gasConstant * air.temperature) + e / (vapourGas * air.temperature)
  )
}

/**
 * Speed of sound in moist air as an ideal mixture of rigid ideal gases, m/s
 * (`apps/docs/docs/models/exterior-atmosphere.md`, "Speed of sound in moist air").
 */
export function speedOfSound(air: Air): number {
  const x = (air.humidity * saturationVapourPressure(air.temperature)) / air.pressure
  // mixture gas constant Rd / (molar mass ratio); cp/R is 3.5 for dry air and 4 for vapour
  const gas = icao.gasConstant / (1 - x + x * vapourRatio)
  const cp = 3.5 + 0.5 * x
  return Math.sqrt((cp / (cp - 1)) * gas * air.temperature)
}

/** Rejects air outside the model's limits with an InputError; returns the air unchanged. */
export function checkAir(air: Air): Air {
  const { altitude, pressure, temperature, humidity } = air
  if (!(altitude >= minAltitude && altitude <= icao.tropopause))
    throw new InputError(`altitude ${altitude} m outside ${minAltitude} to ${icao.tropopause} m`)
  if (!(temperature > 0 && Number.isFinite(temperature)))
    throw new InputError(`temperature ${temperature} K`)
  if (!(humidity >= 0 && humidity <= 1)) throw new InputError(`humidity ${humidity} outside 0..1`)
  if (!(pressure > humidity * saturationVapourPressure(temperature) && Number.isFinite(pressure)))
    throw new InputError(`pressure ${pressure} Pa`)
  return air
}
