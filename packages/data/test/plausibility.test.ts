import type { Bullet, CaseCapacity, ChronoSession, Powder, SpecValue } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import {
  checkBullet,
  checkCapacity,
  checkChronoSession,
  checkPowder,
  checkSpec,
} from '../src/plausibility.ts'

const spec = (values: SpecValue[]) => ({ values })

const cartridge = (symbol: string, value: number, variant?: string): SpecValue => ({
  side: 'cartridge',
  symbol,
  quantity: 'length',
  value,
  variant,
})
const chamber = (symbol: string, value: number): SpecValue => ({
  side: 'chamber',
  symbol,
  quantity: 'length',
  value,
})
const pressure = (symbol: string, value: number, variant?: string): SpecValue => ({
  symbol,
  quantity: 'pressure',
  value,
  variant,
})

const findings = (values: SpecValue[]) => checkSpec(spec(values)).map((f) => f.finding)

describe('checkSpec', () => {
  it('accepts rounded PK and PE for rifle and handgun ratios', () => {
    expect(findings([pressure('Pmax', 4150), pressure('PK', 4773), pressure('PE', 5190)])).toEqual(
      [],
    )
    expect(findings([pressure('Pmax', 2300), pressure('PK', 2645), pressure('PE', 2990)])).toEqual(
      [],
    )
  })

  it('accepts pressures rounded to 10 bar', () => {
    expect(findings([pressure('Pmax', 1050), pressure('PK', 1200), pressure('PE', 1320)])).toEqual(
      [],
    )
  })

  it('flags PK and PE off their ratios, per variant', () => {
    expect(
      findings([
        pressure('Pmax', 740, '12/70'),
        pressure('PK', 800, '12/70'),
        pressure('PE', 900, '12/70'),
      ]),
    ).toEqual(['pk-ratio@12/70', 'pe-ratio@12/70'])
  })

  it('flags a cartridge diameter above the chamber diameter', () => {
    expect(findings([cartridge('P1', 11.96), chamber('P1', 11.99)])).toEqual([])
    expect(findings([cartridge('H2', 8.42), chamber('H2', 8.41)])).toEqual(['diameter-fit:H2'])
  })

  it('flags lengths out of order, allowing L3 equal to L6', () => {
    expect(
      findings([
        cartridge('L1', 30),
        cartridge('L2', 34),
        cartridge('L3', 41),
        cartridge('L6', 41),
      ]),
    ).toEqual([])
    expect(
      findings([
        cartridge('L1', 20),
        cartridge('L2', 20),
        cartridge('L3', 38.8),
        cartridge('L6', 37.3),
      ]),
    ).toEqual(['length-order:L1-L2', 'length-order:L3-L6'])
  })

  it('flags a case longer than its chamber', () => {
    expect(findings([cartridge('L3', 22.38), chamber('L3', 20.45)])).toEqual(['case-fits-chamber'])
  })
})

describe('checkBullet', () => {
  const base: Bullet = {
    id: 'test-bullet',
    manufacturer: 'test-manufacturer',
    productNumber: '1',
    name: 'Test',
    diameter: { value: 7.823 },
    mass: { value: 10.886 },
    provenance: { kind: 'published', sources: [{ title: 'Test' }] },
  }
  const kinds = (b: Partial<Bullet>) => checkBullet({ ...base, ...b }).map((f) => f.finding)

  it('accepts a plausible bullet', () => {
    expect(
      kinds({
        length: { value: 31.29 },
        ballisticCoefficients: [
          { dragModel: 'G1', value: 0.462 },
          { dragModel: 'G7', value: 0.224 },
        ],
        recommendedTwist: { value: 254 },
      }),
    ).toEqual([])
  })

  it('flags misread values', () => {
    expect(kinds({ diameter: { value: 308 } })).toEqual(['diameter-range'])
    expect(kinds({ mass: { value: 168 } })).toEqual(['mass-range'])
    expect(kinds({ mass: { value: 70.5 } })).toEqual(['mass-range'])
    expect(kinds({ mass: { value: 64.9 } })).toEqual([])
    expect(kinds({ ballisticCoefficients: [{ dragModel: 'G1', value: 4.62 }] })).toEqual([
      'ballistic-coefficient-range:G1',
    ])
    expect(
      kinds({
        ballisticCoefficients: [
          { dragModel: 'G1', value: 0.224 },
          { dragModel: 'G7', value: 0.462 },
        ],
      }),
    ).toEqual(['g7-g1-ratio'])
    expect(
      kinds({
        ballisticCoefficients: [
          { dragModel: 'G1', value: 0.273 },
          { dragModel: 'G7', value: 0.246 },
        ],
      }),
    ).toEqual(['g7-g1-ratio'])
    expect(kinds({ length: { value: 70 } })).toEqual(['length-ratio'])
    expect(kinds({ recommendedTwist: { value: 10 } })).toEqual(['twist-range'])
    expect(kinds({ slowestTwist: { value: 2000 } })).toEqual(['twist-range'])
  })
})

describe('checkCapacity', () => {
  const capacity = (value: number): CaseCapacity => ({
    id: 'test-capacity',
    cartridge: 'test',
    waterCapacity: { value },
    provenance: { kind: 'published', sources: [{ title: 'Test' }] },
  })
  // Enclosing cylinder: pi / 4 * 12^2 mm^2 * 50 mm = 5.65 cm3, 5.65 g of water.
  const caseSpec = spec([cartridge('P1', 11.9), cartridge('R1', 12), cartridge('L3', 50)])
  const kinds = (value: number, s?: { values: SpecValue[] }) =>
    checkCapacity(capacity(value), s).map((f) => f.finding)

  it('accepts a capacity inside the enclosing cylinder', () => {
    expect(kinds(3.5, caseSpec)).toEqual([])
    expect(kinds(3.5)).toEqual([])
  })

  it('flags a capacity above the enclosing cylinder or not positive', () => {
    expect(kinds(5.7, caseSpec)).toEqual(['capacity-range'])
    expect(kinds(0)).toEqual(['capacity-range'])
  })

  it('uses P1 or R1 alone when the spec has only one of them', () => {
    // pi / 4 * 12^2 mm^2 * 50 mm = 5.65 g.
    expect(kinds(5.6, spec([cartridge('P1', 12), cartridge('L3', 50)]))).toEqual([])
    expect(kinds(5.7, spec([cartridge('P1', 12), cartridge('L3', 50)]))).toEqual(['capacity-range'])
    expect(kinds(5.6, spec([cartridge('R1', 12), cartridge('L3', 50)]))).toEqual([])
    expect(kinds(5.7, spec([cartridge('R1', 12), cartridge('L3', 50)]))).toEqual(['capacity-range'])
  })
})

describe('checkPowder', () => {
  const range = (value: number) => ({ value, min: value, max: value })
  const base: Powder = {
    id: 'test-powder',
    manufacturer: 'test-manufacturer',
    name: 'Test',
    provenance: { kind: 'published', sources: [{ title: 'Test' }] },
  }
  // 8314.462618 * 3000 / 25 = 997735.5 J/kg.
  const thermo = (impetus: number, gamma = 1.24, covolume = 0.001) => ({
    loadingDensity: { value: 0.1 },
    flameTemperature: range(3000),
    impetus: range(impetus),
    gamma: range(gamma),
    molarMass: range(25),
    covolume: range(covolume),
  })
  const kinds = (p: Partial<Powder>) => checkPowder({ ...base, ...p }).map((f) => f.finding)

  it('accepts plausible values', () => {
    expect(kinds({ bulkDensity: { value: 0.95 }, thermochemistry: thermo(997735) })).toEqual([])
  })

  it('flags each rule', () => {
    expect(kinds({ bulkDensity: { value: 1.7 } })).toEqual(['bulk-density-range'])
    expect(kinds({ bulkDensity: { value: 0 } })).toEqual(['bulk-density-range'])
    expect(kinds({ thermochemistry: thermo(1010000) })).toEqual(['impetus-ideal-gas'])
    expect(kinds({ thermochemistry: thermo(997735, 1) })).toEqual(['gamma-range'])
    expect(kinds({ thermochemistry: thermo(997735, 1.24, 0) })).toEqual(['covolume-range'])
  })

  // 8314.462618 * T / M at the mean composition; min and max set apart from it.
  const t = (p: Partial<NonNullable<Powder['thermochemistry']>>) => ({
    thermochemistry: { ...thermo(997735), ...p },
  })

  it('accepts loading density, flame temperature and molar mass at their bounds', () => {
    expect(kinds(t({ loadingDensity: { value: 1.6 } }))).toEqual([])
    expect(kinds(t({ loadingDensity: { value: 0.01 } }))).toEqual([])
    expect(kinds(t({ flameTemperature: { value: 3000, min: 300, max: 6000 } }))).toEqual([])
    expect(kinds(t({ molarMass: { value: 25, min: 1.01, max: 25 } }))).toEqual([])
  })

  it('flags loading density, flame temperature and molar mass out of range', () => {
    expect(kinds(t({ loadingDensity: { value: 0 } }))).toEqual(['loading-density-range'])
    expect(kinds(t({ loadingDensity: { value: 1.65 } }))).toEqual(['loading-density-range'])
    expect(kinds(t({ flameTemperature: { value: 3000, min: 290, max: 3000 } }))).toEqual([
      'flame-temperature-range',
    ])
    expect(kinds(t({ flameTemperature: { value: 3000, min: 3000, max: 6500 } }))).toEqual([
      'flame-temperature-range',
    ])
    expect(kinds(t({ molarMass: { value: 25, min: 1.008, max: 25 } }))).toEqual([
      'molar-mass-range',
    ])
  })
})

describe('checkChronoSession', () => {
  const base: ChronoSession = {
    id: 'test-session',
    date: '2026-01-01',
    device: { kind: 'doppler-radar', manufacturerName: 'Manufacturer', model: 'X' },
    muzzleDistance: { value: 0 },
    conditions: {
      airTemperature: { value: 15 },
      stationPressure: { value: 1.01325 },
      relativeHumidity: { value: 50 },
    },
    strings: [{ load: 'test-load', shots: [{ velocity: { value: 800 } }] }],
    provenance: { kind: 'measured', sources: [{ title: 'Test' }] },
  }
  const kinds = (s: Partial<ChronoSession>) =>
    checkChronoSession({ ...base, ...s }).map((f) => f.finding)
  const conditions = (c: Partial<ChronoSession['conditions']>) => ({
    conditions: { ...base.conditions, ...c },
  })

  it('accepts plausible values', () => {
    expect(kinds({})).toEqual([])
    expect(kinds(conditions({ airTemperature: { value: -89.2 } }))).toEqual([])
  })

  it('flags each rule', () => {
    expect(
      kinds({ strings: [{ load: 'test-load', shots: [{ velocity: { value: 0 } }] }] }),
    ).toEqual(['velocity-range'])
    expect(kinds(conditions({ relativeHumidity: { value: 120 } }))).toEqual(['humidity-range'])
    expect(kinds(conditions({ relativeHumidity: { value: -1 } }))).toEqual(['humidity-range'])
    expect(kinds(conditions({ airTemperature: { value: 60 } }))).toEqual(['air-temperature-range'])
    expect(kinds(conditions({ airTemperature: { value: -90 } }))).toEqual(['air-temperature-range'])
    expect(kinds(conditions({ stationPressure: { value: 0 } }))).toEqual(['pressure-range'])
    expect(kinds({ muzzleDistance: { value: -1 } })).toEqual(['muzzle-distance-range'])
  })

  const string = (temperature: number) => ({
    strings: [
      {
        load: 'test-load',
        propellantTemperature: { value: temperature },
        shots: [{ velocity: { value: 800 } }],
      },
    ],
  })

  it('accepts station pressure and propellant temperature at their bounds', () => {
    expect(kinds(conditions({ stationPressure: { value: 0.16 } }))).toEqual([])
    expect(kinds(conditions({ stationPressure: { value: 1.2 } }))).toEqual([])
    expect(kinds(string(-89.2))).toEqual([])
    expect(kinds(string(80))).toEqual([])
  })

  it('flags station pressure and propellant temperature out of range', () => {
    // hPa and inHg stored as bar.
    expect(kinds(conditions({ stationPressure: { value: 1013 } }))).toEqual(['pressure-range'])
    expect(kinds(conditions({ stationPressure: { value: 29.92 } }))).toEqual(['pressure-range'])
    expect(kinds(conditions({ stationPressure: { value: 0.15 } }))).toEqual(['pressure-range'])
    expect(kinds(conditions({ stationPressure: { value: 1.21 } }))).toEqual(['pressure-range'])
    expect(kinds(string(-90))).toEqual(['propellant-temperature-range'])
  })
})
