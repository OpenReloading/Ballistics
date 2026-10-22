import { z } from 'zod'

/** The one unit stored in data for each quantity. Solvers convert to SI. */
export interface StoredUnits {
  length: 'mm'
  area: 'mm2'
  mass: 'g'
  density: 'g/cm3'
  pressure: 'bar'
  energy: 'J'
  velocity: 'm/s'
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
  mass: 'g',
  density: 'g/cm3',
  pressure: 'bar',
  energy: 'J',
  velocity: 'm/s',
  angle: 'deg',
  temperature: 'degC',
  absoluteTemperature: 'K',
  specificEnergy: 'J/kg',
  molarMass: 'kg/kmol',
  specificVolume: 'm3/kg',
  burnRate: '1/s',
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
