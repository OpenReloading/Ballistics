import type {
  Bullet,
  Cartridge,
  CatalogueCase,
  CatalogueSession,
  Powder,
  SpecValue,
} from '@open-reloading/schema'

/** A rule violation, identified by `finding` so that a record can acknowledge it. */
export type Finding = {
  finding: string
  message: string
}

/** Pressures are printed rounded, to 10 bar on some sheets: allow 5 bar or 1 %, whichever is larger. */
function near(actual: number, expected: number) {
  return Math.abs(actual - expected) <= Math.max(5, 0.01 * expected)
}
const diameterSymbols = ['P1', 'P2', 'R1', 'H1', 'H2']
const lengthOrder = ['L1', 'L2', 'L3', 'L6']

function findSpecValue(
  values: SpecValue[],
  side: SpecValue['side'],
  symbol: string,
  variant?: string,
) {
  return values.find((v) => v.side === side && v.symbol === symbol && v.variant === variant)?.value
}

function roundToTenth(x: number) {
  return Math.round(x * 10) / 10
}

function suffix(variant: string | undefined) {
  return variant === undefined ? '' : `@${variant}`
}

/** PK is 1.15 times Pmax, PE 1.25 or 1.30 times Pmax. */
function checkPressureRatios(values: SpecValue[], variant: string | undefined): Finding[] {
  const findings: Finding[] = []
  const at = suffix(variant)
  const pmax = findSpecValue(values, undefined, 'Pmax', variant)
  const pk = findSpecValue(values, undefined, 'PK', variant)
  const pe = findSpecValue(values, undefined, 'PE', variant)
  if (pmax !== undefined && pk !== undefined && !near(pk, 1.15 * pmax)) {
    findings.push({
      finding: `pk-ratio${at}`,
      message: `PK = ${pk} bar is not 1.15 × Pmax = ${roundToTenth(1.15 * pmax)} bar`,
    })
  }
  if (pmax !== undefined && pe !== undefined && !near(pe, 1.25 * pmax) && !near(pe, 1.3 * pmax)) {
    findings.push({
      finding: `pe-ratio${at}`,
      message: `PE = ${pe} bar is neither 1.25 nor 1.30 × Pmax = ${pmax} bar`,
    })
  }
  return findings
}

/** No cartridge diameter exceeds the chamber's. */
function checkDiameterFit(values: SpecValue[], variant: string | undefined): Finding[] {
  const findings: Finding[] = []
  for (const symbol of diameterSymbols) {
    const cartridge = findSpecValue(values, 'cartridge', symbol, variant)
    const chamber = findSpecValue(values, 'chamber', symbol, variant)
    if (cartridge !== undefined && chamber !== undefined && cartridge > chamber) {
      findings.push({
        finding: `diameter-fit:${symbol}${suffix(variant)}`,
        message: `cartridge ${symbol} = ${cartridge} mm exceeds chamber ${symbol} = ${chamber} mm`,
      })
    }
  }
  return findings
}

/** Cartridge lengths rise from L1 to L6 (L6 may equal L3). */
function checkLengthOrder(values: SpecValue[], variant: string | undefined): Finding[] {
  const findings: Finding[] = []
  const lengths = lengthOrder
    .map((symbol) => ({ symbol, value: findSpecValue(values, 'cartridge', symbol, variant) }))
    .filter((l): l is { symbol: string; value: number } => l.value !== undefined)
  for (const [i, b] of lengths.entries()) {
    const a = lengths[i - 1]
    if (a === undefined) continue
    const ordered = b.symbol === 'L6' ? a.value <= b.value : a.value < b.value
    if (!ordered) {
      findings.push({
        finding: `length-order:${a.symbol}-${b.symbol}${suffix(variant)}`,
        message: `cartridge ${a.symbol} = ${a.value} mm is not below ${b.symbol} = ${b.value} mm`,
      })
    }
  }
  return findings
}

/** The case length L3 does not exceed the chamber's. */
function checkCaseFitsChamber(values: SpecValue[], variant: string | undefined): Finding[] {
  const caseLength = findSpecValue(values, 'cartridge', 'L3', variant)
  const chamberLength = findSpecValue(values, 'chamber', 'L3', variant)
  if (caseLength !== undefined && chamberLength !== undefined && caseLength > chamberLength) {
    return [
      {
        finding: `case-fits-chamber${suffix(variant)}`,
        message: `cartridge L3 = ${caseLength} mm exceeds chamber L3 = ${chamberLength} mm`,
      },
    ]
  }
  return []
}

/** Checks the values of one sheet; every finding must be fixed or acknowledged in `exceptions`. */
export function checkSpec(spec: Pick<Cartridge, 'values'>): Finding[] {
  const variants = [...new Set(spec.values.map((v) => v.variant))]
  return variants.flatMap((variant) => [
    ...checkPressureRatios(spec.values, variant),
    ...checkDiameterFit(spec.values, variant),
    ...checkLengthOrder(spec.values, variant),
    ...checkCaseFitsChamber(spec.values, variant),
  ])
}

/** Twist per turn in mm, 1:4 to about 1:70 in: pistol and muzzleloader bullets list twists such as 1:48. */
export const twistRange = Object.freeze({ min: 100, max: 1800 })
/** A finite twist inside the range; NaN is not a misprint but a value that was not read. */
export const twistPlausible = (mm: number) =>
  Number.isFinite(mm) && mm >= twistRange.min && mm <= twistRange.max

/** Diameter and mass within small-arms ranges. */
function checkBulletSize(bullet: Bullet): Finding[] {
  const findings: Finding[] = []
  const diameter = bullet.diameter?.value
  const mass = bullet.mass.value
  if (diameter !== undefined && (diameter < 4 || diameter > 20)) {
    findings.push({
      finding: 'diameter-range',
      message: `diameter ${diameter} mm is outside 4 to 20 mm`,
    })
  }
  // Up to 70 g: .50 BMG match bullets reach about 1000 gr (65 g).
  if (mass < 1 || mass > 70) {
    findings.push({ finding: 'mass-range', message: `mass ${mass} g is outside 1 to 70 g` })
  }
  return findings
}

/** Each coefficient within the range of its drag model, and the G7 to G1 ratio of one pair. */
function checkBallisticCoefficients(bullet: Bullet): Finding[] {
  const findings: Finding[] = []
  const ballisticCoefficients = bullet.ballisticCoefficients ?? []
  for (const ballisticCoefficient of ballisticCoefficients) {
    const { dragModel, value } = ballisticCoefficient
    const [low, high] = dragModel === 'G1' ? [0.05, 1.2] : [0.03, 0.65]
    if (value < low || value > high) {
      findings.push({
        finding: `ballistic-coefficient-range:${dragModel}`,
        message: `${dragModel} BC ${value} is outside ${low} to ${high}`,
      })
    }
  }
  // One G1 and one G7 for the same bullet: the G7 is 0.43 to 0.55 times the G1 for every pair in
  // the records; outside 0.35 to 0.65 one of the two is wrong.
  const g1Coefficients = ballisticCoefficients.filter((b) => b.dragModel === 'G1' && !b.minVelocity)
  const g7Coefficients = ballisticCoefficients.filter((b) => b.dragModel === 'G7' && !b.minVelocity)
  const [g1Coefficient, ...moreG1] = g1Coefficients
  const [g7Coefficient, ...moreG7] = g7Coefficients
  if (g1Coefficient && g7Coefficient && moreG1.length === 0 && moreG7.length === 0) {
    const [g1, g7] = [g1Coefficient.value, g7Coefficient.value]
    const ratio = g7 / g1
    if (ratio < 0.35 || ratio > 0.65) {
      findings.push({
        finding: 'g7-g1-ratio',
        message: `G7 ${g7} is ${ratio.toFixed(2)} times G1 ${g1}, outside 0.35 to 0.65`,
      })
    }
  }
  return findings
}

/** Length between 1 and 7 diameters. */
function checkBulletLength(bullet: Bullet): Finding[] {
  if (!bullet.length || !bullet.diameter) return []
  const ratio = bullet.length.value / bullet.diameter.value
  if (!(ratio < 1 || ratio > 7)) return []
  return [
    {
      finding: 'length-ratio',
      message: `length ${bullet.length.value} mm is ${roundToTenth(ratio)} diameters`,
    },
  ]
}

/** Recommended and slowest twist within {@link twistRange}. */
function checkBulletTwist(bullet: Bullet): Finding[] {
  const findings: Finding[] = []
  for (const twist of [bullet.recommendedTwist?.value, bullet.slowestTwist?.value]) {
    if (twist !== undefined && !twistPlausible(twist)) {
      findings.push({
        finding: 'twist-range',
        message: `twist ${twist} mm per turn is outside ${twistRange.min} to ${twistRange.max} mm`,
      })
    }
  }
  return findings
}

/**
 * Checks one bullet record against physical ranges: small-arms diameters and masses, BCs, length
 * against diameter, twist. A finding means a misread or mistyped value; it must be fixed.
 */
export function checkBullet(bullet: Bullet): Finding[] {
  return [
    ...checkBulletSize(bullet),
    ...checkBallisticCoefficients(bullet),
    ...checkBulletLength(bullet),
    ...checkBulletTwist(bullet),
  ]
}

/**
 * Checks one capacity: positive, and at most the water filling the cylinder that encloses the case
 * (the larger of cartridge P1 and R1, times L3, of `spec`, the cartridge's sheet) at
 * 1 g/cm3, the highest density of water.
 */
export function checkCapacity(
  capacity: { waterCapacity: { value: number } },
  spec: Pick<Cartridge, 'values'> | undefined,
): Finding[] {
  const w = capacity.waterCapacity.value
  const values = spec?.values ?? []
  const diameters = ['P1', 'R1']
    .map((symbol) => findSpecValue(values, 'cartridge', symbol))
    .filter((d): d is number => d !== undefined)
  const length = findSpecValue(values, 'cartridge', 'L3')
  // mm3 to cm3 at 1 g/cm3: grams.
  const max =
    diameters.length > 0 && length !== undefined
      ? ((Math.PI / 4) * Math.max(...diameters) ** 2 * length) / 1000
      : Infinity
  if (w > 0 && w <= max) return []
  return [
    {
      finding: 'capacity-range',
      message: `water capacity ${w} g is outside 0 to ${roundToTenth(max)} g (cylinder enclosing the case)`,
    },
  ]
}

/** Bounds of a case product: flash hole diameter in mm and empty case mass in g, wide enough for every cartridge of the catalogue. */
const caseRanges = {
  flashHole: { min: 0.3, max: 5, unit: 'mm' },
  mass: { min: 0.1, max: 400, unit: 'g' },
} as const

/**
 * Checks one case: the flash hole and the empty mass inside small-arms ranges, and the stated water
 * capacity as {@link checkCapacity} checks a measured one against the cartridge's sheet.
 */
export function checkCase(
  record: Pick<CatalogueCase, 'flashHole' | 'mass' | 'waterCapacity'>,
  spec: Pick<Cartridge, 'values'> | undefined,
): Finding[] {
  const out: Finding[] = []
  for (const key of ['flashHole', 'mass'] as const) {
    const v = record[key]?.value
    const { min, max, unit } = caseRanges[key]
    if (v !== undefined && !(v >= min && v <= max))
      out.push({
        finding: `${key}-range`,
        message: `${key === 'mass' ? 'mass' : 'flash hole'} ${v} ${unit} is outside ${min} to ${max} ${unit}`,
      })
  }
  if (record.waterCapacity)
    out.push(...checkCapacity({ waterCapacity: record.waterCapacity }, spec))
  return out
}

/** Universal gas constant, J/(kmol K) (CODATA 2018, exact). */
const universalGasConstant = 8314.462618
/** Below the solid density: safety data sheets print 1.5 and 1.6 g/cm3, rounded to 0.1. */
const bulkDensityMax = 1.65
/** Temperature bracket of the thermochemistry solver, K. */
const flameTemperatureRange = Object.freeze({ min: 300, max: 6000 })
/** Molar mass of H, the lightest product species, kg/kmol. */
const molarMassMin = 1.008

/** Bulk density below the solid density. */
function checkBulkDensity(powder: Powder): Finding[] {
  const bulkDensity = powder.bulkDensity?.value
  if (bulkDensity === undefined || (bulkDensity > 0 && bulkDensity < bulkDensityMax)) return []
  return [
    {
      finding: 'bulk-density-range',
      message: `bulk density ${bulkDensity} g/cm3 is outside 0 to ${bulkDensityMax} g/cm3`,
    },
  ]
}

/**
 * Loading density below the solid density, flame temperature inside the solver's bracket, molar
 * mass above the lightest species, impetus against the ideal gas, gamma and covolume positive.
 */
function checkThermochemistry(thermochemistry: NonNullable<Powder['thermochemistry']>): Finding[] {
  const findings: Finding[] = []
  const load = thermochemistry.loadingDensity.value
  if (!(load > 0 && load < bulkDensityMax)) {
    findings.push({
      finding: 'loading-density-range',
      message: `loading density ${load} g/cm3 is outside 0 to ${bulkDensityMax} g/cm3`,
    })
  }
  const { min, max } = thermochemistry.flameTemperature
  if (!(min >= flameTemperatureRange.min && max <= flameTemperatureRange.max)) {
    findings.push({
      finding: 'flame-temperature-range',
      message: `flame temperature ${min} to ${max} K is outside ${flameTemperatureRange.min} to ${flameTemperatureRange.max} K`,
    })
  }
  if (!(thermochemistry.molarMass.min > molarMassMin)) {
    findings.push({
      finding: 'molar-mass-range',
      message: `molar mass ${thermochemistry.molarMass.min} kg/kmol is not above ${molarMassMin} kg/kmol (H)`,
    })
  }
  const ideal =
    (universalGasConstant * thermochemistry.flameTemperature.value) /
    thermochemistry.molarMass.value
  if (!(Math.abs(thermochemistry.impetus.value - ideal) <= 0.005 * ideal)) {
    findings.push({
      finding: 'impetus-ideal-gas',
      message: `impetus ${thermochemistry.impetus.value} J/kg is more than 0.5 % off R0 T / M = ${Math.round(ideal)} J/kg`,
    })
  }
  if (!(thermochemistry.gamma.min > 1)) {
    findings.push({
      finding: 'gamma-range',
      message: `gamma ${thermochemistry.gamma.min} is not above 1`,
    })
  }
  if (!(thermochemistry.covolume.min > 0)) {
    findings.push({
      finding: 'covolume-range',
      message: `covolume ${thermochemistry.covolume.min} m3/kg is not positive`,
    })
  }
  return findings
}

/**
 * Checks one powder: bulk and loading density below the solid density, thermochemistry inside the
 * solver's temperature bracket, above the lightest species and against the ideal gas.
 */
export function checkPowder(powder: Powder): Finding[] {
  return [
    ...checkBulkDensity(powder),
    ...(powder.thermochemistry ? checkThermochemistry(powder.thermochemistry) : []),
  ]
}

/** World air temperature extremes, degC (WMO 2025). */
export const airTemperatureRange = Object.freeze({ min: -89.2, max: 56.7 })
/**
 * Station pressure, bar: the sea-level extremes of WMO 2025 (870 and 1089.1 hPa) carried to 9000 m
 * and to -500 m in an isothermal column at the coldest air temperature give 0.1635 and 1.1951 bar.
 */
const stationPressureRange = Object.freeze({ min: 0.16, max: 1.2 })

/** Propellant temperature not below the coldest air recorded, every velocity positive. */
function checkShotStrings(strings: CatalogueSession['strings']): Finding[] {
  const findings: Finding[] = []
  strings.forEach((string, i) => {
    // Powder takes the temperature of its surroundings: not below the coldest air recorded.
    const propellantTemperature = string.propellantTemperature?.value
    if (
      propellantTemperature !== undefined &&
      !(propellantTemperature >= airTemperatureRange.min)
    ) {
      findings.push({
        finding: 'propellant-temperature-range',
        message: `string ${i + 1}: propellant temperature ${propellantTemperature} degC is below ${airTemperatureRange.min} degC`,
      })
    }
    string.shots.forEach((shot, k) => {
      if (!(shot.velocity.value > 0)) {
        findings.push({
          finding: 'velocity-range',
          message: `string ${i + 1} shot ${k + 1}: velocity ${shot.velocity.value} m/s is not positive`,
        })
      }
    })
  })
  return findings
}

/** Humidity, air temperature and station pressure within their physical and recorded ranges. */
function checkConditions(conditions: CatalogueSession['conditions']): Finding[] {
  const findings: Finding[] = []
  const relativeHumidity = conditions.relativeHumidity?.value
  if (relativeHumidity !== undefined && !(relativeHumidity >= 0 && relativeHumidity <= 100)) {
    findings.push({
      finding: 'humidity-range',
      message: `relative humidity ${relativeHumidity} % is outside 0 to 100 %`,
    })
  }
  const air = conditions.airTemperature.value
  if (!(air >= airTemperatureRange.min && air <= airTemperatureRange.max)) {
    findings.push({
      finding: 'air-temperature-range',
      message: `air temperature ${air} degC is outside ${airTemperatureRange.min} to ${airTemperatureRange.max} degC`,
    })
  }
  const stationPressure = conditions.stationPressure?.value
  if (
    stationPressure !== undefined &&
    !(stationPressure >= stationPressureRange.min && stationPressure <= stationPressureRange.max)
  ) {
    findings.push({
      finding: 'pressure-range',
      message: `station pressure ${stationPressure} bar is outside ${stationPressureRange.min} to ${stationPressureRange.max} bar`,
    })
  }
  return findings
}

/** Checks one chronograph session against physical limits and the world temperature extremes. */
export function checkChronoSession(session: CatalogueSession): Finding[] {
  const findings = [...checkShotStrings(session.strings), ...checkConditions(session.conditions)]
  const distance = session.muzzleDistance?.value
  if (distance !== undefined && !(distance >= 0)) {
    findings.push({
      finding: 'muzzle-distance-range',
      message: `muzzle distance ${distance} mm is negative`,
    })
  }
  return findings
}
