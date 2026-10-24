import { radPerMoa, radPerMrad, waterDensityGramsPerCm3 } from '@openreloading/core'
import { fromSi, type QuantityKind, toSi } from '@openreloading/schema'

/**
 * Display units. Every value is held in SI; a unit converts to and from SI and has a fixed number
 * of decimals. Factors: NIST SP 811 Appendix B.8 (exact where NIST marks them exact); lb is
 * 0.45359237 kg and standard gravity 9.80665 m/s2 (ICAO Doc 7488/3), so psi and ft lbf are exact
 * products of those.
 */
export type Quantity =
  | 'range'
  | 'length'
  | 'twist'
  | 'barrelLength'
  | 'lineOfSightOffset'
  | 'velocity'
  | 'windSpeed'
  | 'mass'
  | 'firearmMass'
  | 'charge'
  | 'energy'
  | 'temperature'
  | 'temperatureDifference'
  | 'airPressure'
  | 'pressure'
  | 'area'
  | 'altitude'
  | 'capacity'
  | 'specificEnergy'
  | 'ratio'
  | 'density'
  | 'covolume'
  | 'vivacity'
  | 'ballisticCoefficient'
  | 'angle'
  | 'correction'
  | 'percent'
  | 'dragFactor'
  | 'sectionalDensity'

export interface Unit {
  symbol: string
  toSi(x: number): number
  fromSi(si: number): number
  /** Decimals when formatted. */
  decimals: number
  /** Arrow-key step of a field, in this unit. */
  step?: number
}

/** The volume in m3 of `grams` of water: a water capacity as the records store it. */
export const waterVolume = (grams: number) =>
  toSi('mass', grams) / toSi('density', waterDensityGramsPerCm3)

/** The mass in g of the water that fills `m3`: the inverse of {@link waterVolume}. */
export const waterGrams = (m3: number) =>
  fromSi('mass', m3 * toSi('density', waterDensityGramsPerCm3))

export const metersPerInch = 0.0254
export const metersPerFoot = 0.3048
const metersPerYard = 0.9144
export const kilogramsPerGrain = 6.479891e-5
/** 1 mph in m/s. */
export const metersPerSecondPerMph = 0.44704
export const pascalsPerInHg = 3386.389
/** Water density, g/cm³ (defined in core): turns a water capacity in g or gr into a volume. */
export { waterDensityGramsPerCm3 }

const poundForce = 0.45359237 * 9.80665
export const psi = poundForce / metersPerInch ** 2
export const footPound = metersPerFoot * poundForce

/** A unit that is the stored unit of the quantity `kind`, converted by the schema's unit table. */
function stored(kind: QuantityKind, symbol: string, decimals: number, step?: number): Unit {
  return { symbol, toSi: (x) => toSi(kind, x), fromSi: (si) => fromSi(kind, si), decimals, step }
}

function linear(symbol: string, factor: number, decimals: number, step?: number): Unit {
  return { symbol, toSi: (x) => x * factor, fromSi: (si) => si / factor, decimals, step }
}

/** The display units of each quantity, by unit id; the first is the SI-based one. */
export const unitsOf = {
  range: { m: linear('m', 1, 0), yd: linear('yd', metersPerYard, 0) },
  length: { mm: stored('length', 'mm', 2, 0.01), in: linear('in', metersPerInch, 4, 0.0005) },
  // barrel twist, length per turn: 1:10 in on rifles and in load data, 254 mm from barrel makers and C.I.P.
  twist: { mm: stored('length', 'mm', 0), in: linear('in', metersPerInch, 1) },
  // a firearm's barrel length: 24 in on rifles in common metric use, 610 mm in SI
  barrelLength: { mm: stored('length', 'mm', 0, 1), in: linear('in', metersPerInch, 2, 0.25) },
  lineOfSightOffset: {
    cm: linear('cm', 1e-2, 1),
    mm: stored('length', 'mm', 0),
    in: linear('in', metersPerInch, 1),
  },
  velocity: { 'm/s': linear('m/s', 1, 0), 'ft/s': linear('ft/s', metersPerFoot, 0) },
  windSpeed: { 'm/s': linear('m/s', 1, 1), mph: linear('mph', metersPerSecondPerMph, 1) },
  mass: { g: stored('mass', 'g', 2), gr: linear('gr', kilogramsPerGrain, 1) },
  // a firearm's mass: bullet mass units do not fit it
  firearmMass: { kg: linear('kg', 1, 2), lb: linear('lb', 0.45359237, 2) },
  charge: { g: stored('mass', 'g', 2, 0.01), gr: linear('gr', kilogramsPerGrain, 1, 0.1) },
  energy: { J: linear('J', 1, 0), 'ft-lbf': linear('ft·lbf', footPound, 0) },
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
  airPressure: { hPa: linear('hPa', 100, 1), inHg: linear('inHg', pascalsPerInHg, 2) },
  pressure: { bar: stored('pressure', 'bar', 0), psi: linear('psi', psi, 0) },
  area: { mm2: stored('area', 'mm²', 2), in2: linear('in²', metersPerInch ** 2, 5) },
  altitude: { m: linear('m', 1, 0), ft: linear('ft', metersPerFoot, 0) },
  // gr H2O: the volume of that mass of water
  capacity: {
    cm3: linear('cm³', 1e-6, 3),
    grH2O: linear('gr H₂O', kilogramsPerGrain / toSi('density', waterDensityGramsPerCm3), 1),
  },
  specificEnergy: { 'MJ/kg': linear('MJ/kg', 1e6, 3) },
  ratio: { '1': linear('', 1, 3) },
  density: { 'g/cm3': stored('density', 'g/cm³', 3) },
  covolume: { 'cm3/g': linear('cm³/g', 1e-3, 3) },
  vivacity: { '1/s': linear('1/s', 1, 3) },
  ballisticCoefficient: { 'lb/in2': stored('ballisticCoefficient', 'lb/in²', 3) },
  angle: { deg: stored('angle', 'deg', 0) },
  correction: {
    MOA: linear('MOA', radPerMoa, 2),
    mrad: linear('mrad', radPerMrad, 2),
  },
  percent: { '%': linear('%', 0.01, 0) },
  // a multiplier on the drag, 100 % the nominal drag; one decimal keeps a fitted 1.034
  dragFactor: { '%': linear('%', 0.01, 1) },
  // a bullet's mass over its diameter squared, kg/m² in SI; makers print lb/in²
  sectionalDensity: {
    'kg/m2': linear('kg/m²', 1, 1),
    'lb/in2': stored('ballisticCoefficient', 'lb/in²', 3),
  },
} as const satisfies Record<Quantity, Record<string, Unit>>

/** Key of `unitsOf[Q]`, for example 'mm' or 'in' for length. */
type UnitId<Q extends Quantity = Quantity> = keyof (typeof unitsOf)[Q] & string

export type PresetId = 'metric-grains' | 'us' | 'metric-grams'

export const presetNames: Record<PresetId, string> = {
  'metric-grains': 'Metric, common use',
  us: 'US customary',
  'metric-grams': 'Metric (SI)',
}

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
export const presetUnitIds: { [P in PresetId]: { [Q in Quantity]: UnitId<Q> } } = {
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

export function resolveUnits({ preset, overrides }: UnitChoice): UnitSystem {
  const ids = { ...presetUnitIds[preset], ...overrides } as Record<Quantity, string>
  ids.temperatureDifference = ids.temperature
  return Object.fromEntries(
    Object.entries(ids).map(([q, id]) => [q, (unitsOf[q as Quantity] as Record<string, Unit>)[id]]),
  ) as Record<Quantity, Unit>
}

/** `UnitSystem` of preset `preset` with no per-quantity overrides. */
export const presetUnits = (preset: PresetId): UnitSystem => resolveUnits({ preset, overrides: {} })

function isPreset(x: unknown): x is PresetId {
  return typeof x === 'string' && Object.hasOwn(presetUnitIds, x)
}

/** A stored choice; unknown presets, quantities and units are dropped, an override equal to the preset too. */
export function parseUnitChoice(json: string | null): UnitChoice | undefined {
  let value: unknown
  try {
    value = JSON.parse(json ?? '')
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const { preset, overrides } = value as { preset?: unknown; overrides?: unknown }
  if (!isPreset(preset)) return undefined
  const kept: UnitChoice['overrides'] = {}
  if (typeof overrides === 'object' && overrides !== null)
    for (const [q, id] of Object.entries(overrides))
      if (
        Object.hasOwn(unitsOf, q) &&
        typeof id === 'string' &&
        Object.hasOwn(unitsOf[q as Quantity], id) &&
        presetUnitIds[preset][q as Quantity] !== id
      )
        kept[q as Quantity] = id
  return { preset, overrides: kept }
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

/** The length unit of the technical drawings' labels: inches when lengths are shown in inches. */
export const drawingLengthUnit = (system: UnitSystem): 'mm' | 'in' =>
  system.length.symbol === 'in' ? 'in' : 'mm'

/** Stored decimal degrees (converted from degrees, minutes and seconds) to 4 decimals, trailing zeros dropped. */
export function degreeText(x: number): string {
  return String(Number(x.toFixed(4)))
}

/** `x` with exactly `digits` decimals, no grouping and no minus sign on a value that rounds to 0. */
export function formatNumber(x: number, digits: number): string {
  return new Intl.NumberFormat('en', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: 'negative',
    useGrouping: false,
  }).format(x)
}

/**
 * A formatted number in the unit `symbol`: inch values below 1 without the zero before the point
 * (".308", "-.25", as the drawings print them) and a zero as "0"; other units
 * unchanged.
 */
export const inchText = (text: string, symbol: string) =>
  symbol !== 'in' ? text : /^-?0\.0*$/.test(text) ? '0' : text.replace(/^(-?)0\./, '$1.')

/** An SI value in the unit of `q` in `system`, without the symbol. */
export function formatQuantity(q: Quantity, system: UnitSystem, si: number): string {
  const unit = system[q]
  return inchText(formatNumber(unit.fromSi(si), unit.decimals), unit.symbol)
}

/** A time in s as milliseconds with 3 decimals: "1.234 ms". */
export const msText = (s: number) => `${formatNumber(s * 1e3, 3)} ms`

/** A fraction as a percentage with 1 decimal: "12.5 %". */
export const percentText = (fraction: number) => `${formatNumber(fraction * 100, 1)} %`

/** An SI value in the unit of `q` in `system`, with the unit's symbol. */
export const withUnit = (q: Quantity, system: UnitSystem, si: number) =>
  `${formatQuantity(q, system, si)} ${system[q].symbol}`

/**
 * A twist as typed: "1:8", "1 in 8" or "8", one turn per
 * that many units of the field's length unit. Undefined for any other text.
 */
export function parseTwist(text: string): number | undefined {
  const m = /^\s*(?:1\s*(?::|in)\s*)?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/i.exec(text)
  return m ? Number(m[1]) : undefined
}

/** A twist's number as field text: "1:8"; 0 (no rifling) stays "0". */
const twistLabel = (n: string) => (Number(n) === 0 ? n : `1:${n}`)

/** The typed twist in the form the field shows it ("8" and "1 in 8" read "1:8"); undefined when invalid. */
export function twistTyped(text: string): string | undefined {
  const n = parseTwist(text)
  return n === undefined ? undefined : twistLabel(String(n))
}

/** An SI value as field text in the unit of `q` in `system`: 6 significant digits. */
export function exactFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const text = String(Number(system[q].fromSi(si).toPrecision(6)))
  return q === 'twist' ? twistLabel(text) : text
}

/**
 * An SI value as a workbench field shows it: `roundedFieldText` with its trailing zeros (37.0 gr,
 * 0.300 in), so the values of a card align by their decimals. A twist is as `roundedFieldText`.
 */
export function fixedFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const { fromSi, decimals } = system[q]
  const x = fromSi(si)
  if (q === 'twist' || x === 0 || !Number.isFinite(x)) return roundedFieldText(q, system, si)
  const d = Math.max(decimals, 2 - Math.floor(Math.log10(Math.abs(x))))
  return x.toFixed(Math.min(d, 12))
}

/**
 * An SI value as a calculator field shows it (38.3 gr, not 38.2722): the
 * unit's display decimals, at least three significant digits, no trailing zeros. The field keeps
 * the exact SI value beside the text and a unit switch converts from it, so nothing drifts. The
 * designers use it too: no six-decimal inches beside a drawing in mm.
 */
export function roundedFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const { fromSi, decimals } = system[q]
  const x = fromSi(si)
  if (x === 0 || !Number.isFinite(x)) return String(x)
  const d = Math.max(decimals, 2 - Math.floor(Math.log10(Math.abs(x))))
  const text = String(Number(x.toFixed(Math.min(d, 12))))
  return q === 'twist' ? twistLabel(text) : text
}
