import {
  conversions,
  fromSi,
  type QuantityKind,
  toSi,
  waterDensityGramsPerCm3,
} from '@open-reloading/units'

/**
 * Display units. Every value is held in SI; a unit converts to and from SI and has a fixed number
 * of decimals. The customary factors are those of `conversions` in `@open-reloading/units`.
 */
export interface Unit {
  /** The symbol shown after a value: "mm", "gr H₂O"; empty for a ratio. */
  symbol: string
  /** A value in this unit, in SI. */
  toSi(x: number): number
  /** An SI value in this unit. */
  fromSi(si: number): number
  /** Decimals when formatted. */
  decimals: number
  /** Arrow-key step of a field, in this unit. */
  step?: number | undefined
}

/** The display unit ids of each quantity; the first is the SI-based one. */
export interface UnitIds {
  range: 'm' | 'yd'
  length: 'mm' | 'in'
  twist: 'mm' | 'in'
  barrelLength: 'mm' | 'in'
  lineOfSightOffset: 'cm' | 'mm' | 'in'
  velocity: 'm/s' | 'ft/s'
  windSpeed: 'm/s' | 'mph'
  mass: 'g' | 'gr'
  firearmMass: 'kg' | 'lb'
  charge: 'g' | 'gr'
  energy: 'J' | 'ft-lbf'
  temperature: 'degC' | 'degF'
  temperatureDifference: 'degC' | 'degF'
  airPressure: 'hPa' | 'inHg'
  pressure: 'bar' | 'psi'
  area: 'mm2' | 'in2'
  altitude: 'm' | 'ft'
  capacity: 'cm3' | 'grH2O'
  specificEnergy: 'MJ/kg'
  molarMass: 'kg/kmol'
  ratio: '1'
  density: 'g/cm3'
  covolume: 'cm3/g'
  vivacity: '1/s'
  ballisticCoefficient: 'lb/in2'
  angle: 'deg'
  correction: 'MOA' | 'mrad'
  percent: '%'
  dragFactor: '%'
  sectionalDensity: 'kg/m2' | 'lb/in2'
}

/** A quantity shown in a display unit. */
export type Quantity = keyof UnitIds

const inch = conversions.in.factor
const grain = conversions.gr.factor

/** A unit that is the stored unit of the quantity `kind`, converted by the unit table of `units`. */
function stored(kind: QuantityKind, symbol: string, decimals: number, step?: number): Unit {
  return { symbol, toSi: (x) => toSi(kind, x), fromSi: (si) => fromSi(kind, si), decimals, step }
}

function linear(symbol: string, factor: number, decimals: number, step?: number): Unit {
  return { symbol, toSi: (x) => x * factor, fromSi: (si) => si / factor, decimals, step }
}

/** The display units of each quantity, by unit id. */
export const unitsOf: { readonly [Q in Quantity]: { readonly [U in UnitIds[Q]]: Unit } } = {
  range: { m: linear('m', 1, 0), yd: linear('yd', conversions.yd.factor, 0) },
  length: { mm: stored('length', 'mm', 2, 0.01), in: linear('in', inch, 4, 0.0005) },
  // barrel twist, length per turn: 1:10 in on rifles and in load data, 254 mm from barrel makers and C.I.P.
  twist: { mm: stored('length', 'mm', 0), in: linear('in', inch, 1) },
  // a firearm's barrel length: 24 in on rifles in common metric use, 610 mm in SI
  barrelLength: { mm: stored('length', 'mm', 0, 1), in: linear('in', inch, 2, 0.25) },
  lineOfSightOffset: {
    cm: linear('cm', 1e-2, 1),
    mm: stored('length', 'mm', 0),
    in: linear('in', inch, 1),
  },
  velocity: { 'm/s': linear('m/s', 1, 0), 'ft/s': linear('ft/s', conversions.ft.factor, 0) },
  windSpeed: { 'm/s': linear('m/s', 1, 1), mph: linear('mph', conversions.mph.factor, 1) },
  mass: { g: stored('mass', 'g', 2), gr: linear('gr', grain, 1) },
  // a firearm's mass: bullet mass units do not fit it
  firearmMass: { kg: linear('kg', 1, 2), lb: linear('lb', conversions.lb.factor, 2) },
  charge: { g: stored('mass', 'g', 2, 0.01), gr: linear('gr', grain, 1, 0.1) },
  energy: { J: linear('J', 1, 0), 'ft-lbf': linear('ft·lbf', conversions['ft-lbf'].factor, 0) },
  temperature: {
    degC: stored('temperature', '°C', 1),
    degF: {
      symbol: '°F',
      toSi: (t) => toSi('temperature', ((t - 32) * 5) / 9),
      fromSi: (k) => (fromSi('temperature', k) * 9) / 5 + 32,
      decimals: 1,
    },
  },
  // a step between temperatures: no offset, and the unit follows the temperature's (`resolveUnits`)
  temperatureDifference: {
    degC: linear('°C', 1, 1, 0.5),
    degF: linear('°F', 5 / 9, 1, 1),
  },
  airPressure: { hPa: linear('hPa', 100, 1), inHg: linear('inHg', conversions.inHg.factor, 2) },
  pressure: { bar: stored('pressure', 'bar', 0), psi: linear('psi', conversions.psi.factor, 0) },
  area: { mm2: stored('area', 'mm²', 2), in2: linear('in²', inch ** 2, 5) },
  altitude: { m: linear('m', 1, 0), ft: linear('ft', conversions.ft.factor, 0) },
  // gr H2O: the volume of that mass of water
  capacity: {
    cm3: linear('cm³', 1e-6, 3),
    grH2O: linear('gr H₂O', grain / toSi('density', waterDensityGramsPerCm3), 1),
  },
  specificEnergy: { 'MJ/kg': linear('MJ/kg', 1e6, 3) },
  molarMass: { 'kg/kmol': stored('molarMass', 'kg/kmol', 2) },
  ratio: { '1': linear('', 1, 3) },
  density: { 'g/cm3': stored('density', 'g/cm³', 3) },
  covolume: { 'cm3/g': linear('cm³/g', 1e-3, 3) },
  vivacity: { '1/s': linear('1/s', 1, 3) },
  ballisticCoefficient: { 'lb/in2': stored('ballisticCoefficient', 'lb/in²', 3) },
  angle: { deg: stored('angle', 'deg', 0) },
  correction: {
    MOA: linear('MOA', conversions.MOA.factor, 2),
    mrad: linear('mrad', 1e-3, 2),
  },
  percent: { '%': linear('%', 0.01, 0) },
  // a multiplier on the drag, 100 % the nominal drag; one decimal keeps a fitted 1.034
  dragFactor: { '%': linear('%', 0.01, 1) },
  // a bullet's mass over its diameter squared, kg/m² in SI; makers print lb/in²
  sectionalDensity: {
    'kg/m2': linear('kg/m²', 1, 1),
    'lb/in2': stored('ballisticCoefficient', 'lb/in²', 3),
  },
}

/** A preset of display units. */
export type PresetId = 'metric-grains' | 'us' | 'metric-grams'

const metricBase = {
  firearmMass: 'kg',
  range: 'm',
  length: 'mm',
  velocity: 'm/s',
  windSpeed: 'm/s',
  energy: 'J',
  temperature: 'degC',
  temperatureDifference: 'degC',
  airPressure: 'hPa',
  pressure: 'bar',
  area: 'mm2',
  altitude: 'm',
} as const

const single = {
  specificEnergy: 'MJ/kg',
  molarMass: 'kg/kmol',
  ratio: '1',
  density: 'g/cm3',
  covolume: 'cm3/g',
  vivacity: '1/s',
  ballisticCoefficient: 'lb/in2',
  angle: 'deg',
  percent: '%',
  dragFactor: '%',
} as const

/** The unit of each quantity per preset. */
export const presetUnitIds: { readonly [P in PresetId]: Readonly<UnitIds> } = {
  'metric-grains': {
    ...metricBase,
    ...single,
    mass: 'gr',
    charge: 'gr',
    capacity: 'grH2O',
    twist: 'in',
    barrelLength: 'in',
    lineOfSightOffset: 'cm',
    correction: 'mrad',
    // lb/in² where bullets weigh in grains, as maker sheets print it; no override in Settings
    sectionalDensity: 'lb/in2',
  },
  us: {
    ...single,
    range: 'yd',
    length: 'in',
    velocity: 'ft/s',
    windSpeed: 'mph',
    energy: 'ft-lbf',
    temperature: 'degF',
    temperatureDifference: 'degF',
    airPressure: 'inHg',
    pressure: 'psi',
    area: 'in2',
    altitude: 'ft',
    mass: 'gr',
    firearmMass: 'lb',
    charge: 'gr',
    capacity: 'grH2O',
    twist: 'in',
    barrelLength: 'in',
    lineOfSightOffset: 'in',
    correction: 'MOA',
    sectionalDensity: 'lb/in2',
  },
  'metric-grams': {
    ...metricBase,
    ...single,
    mass: 'g',
    charge: 'g',
    capacity: 'cm3',
    twist: 'mm',
    barrelLength: 'mm',
    lineOfSightOffset: 'mm',
    correction: 'mrad',
    sectionalDensity: 'kg/m2',
  },
}

/** The viewer's choice: a preset and the quantities set to another unit. */
export type UnitChoice = { preset: PresetId; overrides: Partial<Record<Quantity, string>> }

/** Display units: the unit of every quantity. */
export type UnitSystem = Readonly<Record<Quantity, Unit>>

const isQuantity = (q: string): q is Quantity => Object.hasOwn(unitsOf, q)

const quantities = Object.keys(unitsOf).filter(isQuantity)

const isUnitOf = <U extends string>(table: { readonly [K in U]: Unit }, id: string): id is U =>
  Object.hasOwn(table, id)

/** The unit `id` of `q`, the preset's unit `fallback` for an id that `q` has not. */
function unitOf<Q extends Quantity>(q: Q, id: string, fallback: UnitIds[Q]): Unit {
  const table: { readonly [U in UnitIds[Q]]: Unit } = unitsOf[q]
  return isUnitOf(table, id) ? table[id] : table[fallback]
}

/** The units of a choice; a temperature difference takes the unit of the temperature. */
export function resolveUnits({ preset, overrides }: UnitChoice): UnitSystem {
  const ids = presetUnitIds[preset]
  const chosen = (q: Quantity) => overrides[q] ?? ids[q]
  const system = Object.fromEntries(
    quantities.map((q) => [
      q,
      unitOf(q, chosen(q === 'temperatureDifference' ? 'temperature' : q), ids[q]),
    ]),
  )
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- fromEntries drops the keys: `quantities` holds every one
  return system as UnitSystem
}

/** `UnitSystem` of preset `preset` with no per-quantity overrides. */
export const presetUnits = (preset: PresetId): UnitSystem => resolveUnits({ preset, overrides: {} })

function isPreset(x: unknown): x is PresetId {
  return typeof x === 'string' && Object.hasOwn(presetUnitIds, x)
}

/** The overrides of `value` that name a quantity and one of its units other than the preset's. */
function keptOverrides(preset: PresetId, value: unknown): UnitChoice['overrides'] {
  const kept: UnitChoice['overrides'] = {}
  if (typeof value !== 'object' || value === null) return kept
  for (const [q, id] of Object.entries(value))
    if (
      isQuantity(q) &&
      typeof id === 'string' &&
      Object.hasOwn(unitsOf[q], id) &&
      presetUnitIds[preset][q] !== id
    )
      kept[q] = id
  return kept
}

/** A stored choice; unknown presets, quantities and units are dropped, an override equal to the preset too. */
export function parseUnitChoice(json: string | null): UnitChoice | undefined {
  let value: unknown
  try {
    value = JSON.parse(json ?? '')
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null || !('preset' in value)) return undefined
  const { preset } = value
  if (!isPreset(preset)) return undefined
  return { preset, overrides: keptOverrides(preset, 'overrides' in value ? value.overrides : {}) }
}

/** The preset of a link's `units`: a preset id, or the old `metric` and `imperial`. */
export function presetFromLink(u: string | null): PresetId | undefined {
  if (u === 'metric') return 'metric-grams'
  if (u === 'imperial') return 'us'
  return isPreset(u) ? u : undefined
}

/** The default preset of a locale: US customary in the US, else metric with grains. */
export function localePreset(locale: string): PresetId {
  return /-US\b/i.test(locale) ? 'us' : 'metric-grains'
}
