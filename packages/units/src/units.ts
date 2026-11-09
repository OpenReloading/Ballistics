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
export const units: Readonly<StoredUnits> = {
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

/** Every stored unit, plus the customary units that published fits, imported files and the display units are written in. */
export type UnitId =
  | StoredUnits[QuantityKind]
  | 'in'
  | 'ft'
  | 'yd'
  | 'gr'
  | 'lb'
  | 'mph'
  | 'inHg'
  | 'psi'
  | 'ft-lbf'
  | 'MOA'

/** Map from a unit to SI: `si = value * factor + offset`. */
export interface SiMap {
  readonly factor: number
  readonly offset: number
}

const scale = (factor: number): SiMap => ({ factor, offset: 0 })

/** kg per avoirdupois pound (exact). */
const pound = 0.45359237
/** m per inch (exact). */
const inch = 0.0254
/** m per foot (exact). */
const foot = 0.3048
/** Standard gravity, m/s2 (exact), which defines the pound-force. */
const gravity = 9.80665

/** Percent is a fraction in SI, the ballistic coefficient kg/m2 and temperature K; customary factors are the exact definitions (NIST SP 811, appendix B), except the conventional inch of mercury. */
export const conversions: Readonly<Record<UnitId, SiMap>> = {
  mm: scale(1e-3),
  mm2: scale(1e-6),
  cm3: scale(1e-6),
  g: scale(1e-3),
  'g/cm3': scale(1e3),
  bar: scale(1e5),
  J: scale(1),
  'm/s': scale(1),
  s: scale(1),
  deg: scale(Math.PI / 180),
  degC: { factor: 1, offset: 273.15 },
  K: scale(1),
  'J/kg': scale(1),
  'kg/kmol': scale(1),
  'm3/kg': scale(1),
  '1/s': scale(1),
  '1/K': scale(1),
  '%': scale(0.01),
  '1': scale(1),
  'lb/in2': scale(pound / inch ** 2),
  in: scale(inch),
  ft: scale(foot),
  yd: scale(0.9144),
  // 64.79891 mg exactly; pound / 7000 lands one ulp above the double nearest to it
  gr: scale(6.479891e-5),
  lb: scale(pound),
  mph: scale(0.44704),
  inHg: scale(3386.389),
  psi: scale((pound * gravity) / inch ** 2),
  'ft-lbf': scale(foot * (pound * gravity)),
  MOA: scale(Math.PI / 10800),
}

/** Water at 20 °C, g/cm³ (998.2067 kg/m³ from the table of Tanaka et al., Metrologia 38 (2001) 301, https://doi.org/10.1088/0026-1394/38/4/3; the table value is unverified, not re-read from the paper): turns a case water capacity in g or gr into a volume. */
export const waterDensityGramsPerCm3 = 0.9982

/** The map to SI of each quantity's stored unit: the conversion of `units[kind]`. */
export const siMaps: Readonly<Record<QuantityKind, SiMap>> = {
  length: conversions.mm,
  area: conversions.mm2,
  volume: conversions.cm3,
  mass: conversions.g,
  density: conversions['g/cm3'],
  pressure: conversions.bar,
  energy: conversions.J,
  velocity: conversions['m/s'],
  time: conversions.s,
  angle: conversions.deg,
  temperature: conversions.degC,
  absoluteTemperature: conversions.K,
  specificEnergy: conversions['J/kg'],
  molarMass: conversions['kg/kmol'],
  specificVolume: conversions['m3/kg'],
  burnRate: conversions['1/s'],
  inverseTemperature: conversions['1/K'],
  massFraction: conversions['%'],
  relativeHumidity: conversions['%'],
  count: conversions['1'],
  dimensionless: conversions['1'],
  ballisticCoefficient: conversions['lb/in2'],
}

/** A number in the stored unit of quantity kind `K`. The brand exists only for the type checker. */
export type Stored<K extends QuantityKind> = number & { readonly storedUnitOf: K }

/** A number in the SI unit of quantity kind `K`. The brand exists only for the type checker. */
export type Si<K extends QuantityKind> = number & { readonly siUnitOf: K }

// toSi and fromSi read `conversions`, not `siMaps`, so a bundle that never imports `siMaps` drops it

/** A value of quantity `kind` in its stored unit, in SI; a value already in SI, or stored for another kind, is refused. */
export const toSi = <K extends QuantityKind>(
  kind: K,
  stored: number & { readonly siUnitOf?: never; readonly storedUnitOf?: NoInfer<K> },
): Si<K> => {
  const { factor, offset } = conversions[units[kind]]
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a brand has no runtime form: it is set here
  return (stored * factor + offset) as Si<K>
}

/** From SI to its stored unit, the inverse of {@link toSi}; a value already in its stored unit, or in SI for another kind, is refused. */
export const fromSi = <K extends QuantityKind>(
  kind: K,
  si: number & { readonly storedUnitOf?: never; readonly siUnitOf?: NoInfer<K> },
): Stored<K> => {
  const { factor, offset } = conversions[units[kind]]
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a brand has no runtime form: it is set here
  return ((si - offset) / factor) as Stored<K>
}
