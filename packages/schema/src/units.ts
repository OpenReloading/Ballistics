import { z } from 'zod'

/** The one unit stored in data for each quantity. Solvers convert to SI. */
export interface StoredUnits {
  length: 'mm'
  area: 'mm2'
  /** Case capacity as a volume. */
  volume: 'cm3'
  mass: 'g'
  density: 'g/cm3'
  pressure: 'bar'
  energy: 'J'
  velocity: 'm/s'
  /** Time limits of a course of fire. */
  time: 's'
  angle: 'deg'
  temperature: 'degC'
  /** Flame and gas temperatures of thermochemistry; ambient temperatures use `temperature`. */
  absoluteTemperature: 'K'
  /** Impetus (specific force) of a propellant. */
  specificEnergy: 'J/kg'
  molarMass: 'kg/kmol'
  /** Covolume of propellant gas. */
  specificVolume: 'm3/kg'
  /** Vivacity of a burn law in the M3 interior model. */
  burnRate: '1/s'
  /** Burn-rate sensitivity of a propellant to its temperature. */
  inverseTemperature: '1/K'
  /** Ingredient content as safety data sheets print it. */
  massFraction: '%'
  relativeHumidity: '%'
  count: '1'
  /** Mach numbers and aerodynamic coefficients. */
  dimensionless: '1'
  /** Ballistic coefficient in the unit makers publish it in. */
  ballisticCoefficient: 'lb/in2'
}

/** The stored unit of each quantity, see {@link StoredUnits}. */
export const units: StoredUnits = {
  length: 'mm',
  area: 'mm2',
  volume: 'cm3',
  mass: 'g',
  density: 'g/cm3',
  pressure: 'bar',
  energy: 'J',
  velocity: 'm/s',
  time: 's',
  angle: 'deg',
  temperature: 'degC',
  absoluteTemperature: 'K',
  specificEnergy: 'J/kg',
  molarMass: 'kg/kmol',
  specificVolume: 'm3/kg',
  burnRate: '1/s',
  inverseTemperature: '1/K',
  massFraction: '%',
  relativeHumidity: '%',
  count: '1',
  dimensionless: '1',
  ballisticCoefficient: 'lb/in2',
}

/** Name of a quantity: a key of {@link units}. */
export type QuantityKind = keyof StoredUnits

/** Schema of a {@link QuantityKind}: one of the keys of {@link units}, such as `length` or `pressure`. */
export const quantityKind = z.enum(Object.keys(units) as [QuantityKind, ...QuantityKind[]])

/** Map from the stored unit of a quantity to its SI unit: `si = stored * factor + offset`. */
export interface SiMap {
  factor: number
  offset: number
}

const scale = (factor: number): SiMap => ({ factor, offset: 0 })

/**
 * The map to SI of each quantity's stored unit. Percent is a fraction in SI, the ballistic
 * coefficient kg/m2 (1 lb = 0.45359237 kg, 1 in = 0.0254 m), temperature K.
 */
export const siMaps: Record<QuantityKind, SiMap> = {
  length: scale(1e-3),
  area: scale(1e-6),
  volume: scale(1e-6),
  mass: scale(1e-3),
  density: scale(1e3),
  pressure: scale(1e5),
  energy: scale(1),
  velocity: scale(1),
  time: scale(1),
  angle: scale(Math.PI / 180),
  temperature: { factor: 1, offset: 273.15 },
  absoluteTemperature: scale(1),
  specificEnergy: scale(1),
  molarMass: scale(1),
  specificVolume: scale(1),
  burnRate: scale(1),
  inverseTemperature: scale(1),
  massFraction: scale(0.01),
  relativeHumidity: scale(0.01),
  count: scale(1),
  dimensionless: scale(1),
  ballisticCoefficient: scale(0.45359237 / 0.0254 ** 2),
}

/** A value of quantity `kind` in its stored unit, in SI. */
export const toSi = (kind: QuantityKind, stored: number) =>
  stored * siMaps[kind].factor + siMaps[kind].offset

/** A value of quantity `kind` in SI, in its stored unit: the inverse of {@link toSi}. */
export const fromSi = (kind: QuantityKind, si: number) =>
  (si - siMaps[kind].offset) / siMaps[kind].factor

/**
 * A value in the unit of its quantity, plus the value as written in the source when it differed.
 * `value` may carry bounds (`z.number().positive()`), which the JSON Schema keeps.
 */
export function quantity(kind: QuantityKind, value: z.ZodNumber = z.number()) {
  return z
    .object({
      value: value.describe(`In ${units[kind]}.`),
      raw: z
        .string()
        .min(1)
        .describe('The value as written in the source, when it differed.')
        .optional(),
    })
    .meta({ unit: units[kind] })
}

/**
 * Type of the object {@link quantity} returns: `value` in the stored unit and the optional source
 * text `raw`.
 */
export type QuantityValue = z.infer<ReturnType<typeof quantity>>
