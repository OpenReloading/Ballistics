import { describe, expect, it } from 'vitest'
import { interiorLoad } from '../src/interior/load-file.ts'
import { type InteriorLoad, interior } from '../src/interior/model.ts'
import { wornVolume } from '../src/interior/throat-wear.ts'
import { vuong2026 } from '../src/interior/throat-wear-measurement.ts'

describe('wornVolume', () => {
  it('adds the wear length times the bore area', () => {
    expect(wornVolume(1.85e-6, 2.43e-5, 5.42e-3)).toBeCloseTo(1.85e-6 + 5.42e-3 * 2.43e-5, 15)
    expect(wornVolume(1.85e-6, 2.43e-5, 0)).toBe(1.85e-6)
  })
})

describe('interiorLoad with throat wear', () => {
  const values = {
    volume: 3.4e-6,
    boreDiameter: 7.62e-3,
    boreArea: 4.7e-5,
    travel: 0.56,
    twist: 0.254,
    bulletMass: 0.0108,
    charge: 2.9e-3,
    propellantEnergy: 3.8e6,
    gamma: 1.24,
    density: 1600,
    covolume: 1e-3,
    vivacity: 900,
    exponent: 1,
    referencePressure: 1e8,
    propellantTemperature: 294.15,
    ignitionPressure: 5e6,
    startPressure: 3e7,
  }
  it('carries the wear on the chamber and leaves the case volume as it is, none without wear', () => {
    expect(interiorLoad(values).chamber).not.toHaveProperty('throatWear')
    const worn = interiorLoad({ ...values, throatWear: 2e-3 }).chamber
    expect(worn.volume).toBe(3.4e-6)
    expect(worn.throatWear).toBe(2e-3)
  })
  it('runs a worn throat as the same load with the wear times the bore area added to its volume', () => {
    const load = interiorLoad({ ...values, throatWear: 2e-3 })
    const worn = interior(load)
    const larger = interior({
      ...load,
      chamber: { ...load.chamber, volume: 3.4e-6 + 2e-3 * 4.7e-5, throatWear: undefined },
    })
    if (!worn.valid || !larger.valid) throw new Error('invalid')
    expect(worn.peakBreechPressure).toBeCloseTo(larger.peakBreechPressure, 0)
    expect(worn.muzzleVelocity).toBeCloseTo(larger.muzzleVelocity, 9)
  })
  it('refuses a negative wear', () => {
    expect(() => interiorLoad({ ...values, throatWear: -1e-3 })).toThrow(/at least 0/)
  })
})

/**
 * The 5.56x45 mm load of Vuong et al. 2026 (table 1): 1.8 g charge, 4 g projectile, 1.85 cm3
 * chamber, bore area 2.43e-5 m2, force 706079 J/kg, gamma 1.26, covolume 1e-3 m3/kg, primer 2.94
 * MPa, shot start 29.42 MPa. Constant form, the vivacity set so the new barrel peaks at the
 * authors' 350 MPa (their table 2); travel 0.312 m of the 0.361 m barrel. The worn barrel adds the
 * measured axial wear of 5.42 mm (54.62 - 49.20 mm).
 */
describe('throat wear against Vuong et al. 2026', () => {
  const area = 2.43e-5
  const load = (volume: number): InteriorLoad => ({
    chamber: { volume, boreArea: area, boreDiameter: 5.56e-3 },
    barrel: { length: 0.312, twist: 0 },
    bullet: { mass: 0.004 },
    charge: 0.0018,
    propellant: {
      specificEnergy: 706079 / 0.26,
      gamma: 1.26,
      density: 1600,
      covolume: 1e-3,
      burn: {
        kind: 'vivacity',
        vivacity: 621.1,
        exponent: 1,
        referencePressure: 1e8,
        form: { kind: 'constant' },
      },
    },
    propellantTemperature: 288.15,
    ignitionPressure: 2.94e6,
    startPressure: 29.42e6,
  })
  const run = (volume: number) => {
    const r = interior(load(volume))
    if (!r.valid) throw new Error(r.reason)
    return r
  }
  const wear = vuong2026.chamberLength.worn - vuong2026.chamberLength.new

  it('the new barrel peaks at the authors 350 MPa', () => {
    expect(run(1.85e-6).peakBreechPressure / 1e6).toBeCloseTo(350, 0)
  })

  it('the measured wear lowers the velocity within 1 percentage point of the authors model', () => {
    const fresh = run(1.85e-6)
    const worn = interior({
      ...load(1.85e-6),
      chamber: { ...load(1.85e-6).chamber, throatWear: wear },
    })
    if (!worn.valid) throw new Error(worn.reason)
    const dv = worn.muzzleVelocity / fresh.muzzleVelocity - 1
    const dp = worn.peakBreechPressure / fresh.peakBreechPressure - 1
    expect(Math.abs(dv - vuong2026.modelChange.muzzleVelocity)).toBeLessThan(0.01)
    // the peak falls 16.8 % against their 15.6 %: within 1.5 points, not 1 (research log)
    expect(Math.abs(dp - vuong2026.modelChange.peakPressure)).toBeLessThan(0.015)
    // and the velocity change lies within 2 points of the measured -6.5 %
    const [first, last] = [vuong2026.velocity.at(0)?.[1] ?? 0, vuong2026.velocity.at(-1)?.[1] ?? 0]
    expect(Math.abs(dv - (last / first - 1))).toBeLessThan(0.02)
  })
})

describe('the charge fit with a worn throat', () => {
  it('checks the charge against the case volume, not the gas volume the wear adds', () => {
    const load = interiorLoad({
      volume: 3.4e-6,
      boreDiameter: 7.62e-3,
      boreArea: 4.7e-5,
      travel: 0.56,
      twist: 0.254,
      bulletMass: 0.0108,
      // a solid volume of 3.5 cm3: above the case, below case plus 10 mm of wear
      charge: 5.6e-3,
      propellantEnergy: 3.8e6,
      gamma: 1.24,
      density: 1600,
      covolume: 1e-3,
      vivacity: 900,
      exponent: 1,
      referencePressure: 1e8,
      propellantTemperature: 294.15,
      ignitionPressure: 5e6,
      startPressure: 3e7,
      throatWear: 10e-3,
    })
    expect(interior(load)).toMatchObject({ valid: false, reason: 'chamberVolume' })
  })
})
