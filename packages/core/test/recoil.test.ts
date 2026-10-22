import { describe, expect, it } from 'vitest'
import { freeRecoil, gasVelocityFactor, InputError } from '../src/index.ts'

describe('freeRecoil', () => {
  it('rifle: 4 kg gun, 10 g at 800 m/s, 3 g charge, factor 1.75', () => {
    // momentum 0.01 * 800 + 0.003 * 1.75 * 800 = 8 + 4.2 = 12.2 kg m/s
    // velocity 12.2 / 4 = 3.05 m/s, energy 0.5 * 4 * 3.05^2 = 18.605 J
    const r = freeRecoil({
      firearmMass: 4,
      projectileMass: 0.01,
      chargeMass: 0.003,
      muzzleVelocity: 800,
      gasFactor: gasVelocityFactor.rifle,
    })
    expect(r.momentum).toBeCloseTo(12.2, 12)
    expect(r.velocity).toBeCloseTo(3.05, 12)
    expect(r.energy).toBeCloseTo(18.605, 12)
  })

  it('pistol: 1 kg gun, 8 g at 360 m/s, 0.4 g charge, factor 1.5', () => {
    // momentum 0.008 * 360 + 0.0004 * 1.5 * 360 = 2.88 + 0.216 = 3.096 kg m/s
    // velocity 3.096 m/s, energy 0.5 * 1 * 3.096^2 = 4.792608 J
    const r = freeRecoil({
      firearmMass: 1,
      projectileMass: 0.008,
      chargeMass: 0.0004,
      muzzleVelocity: 360,
      gasFactor: gasVelocityFactor.pistol,
    })
    expect(r.velocity).toBeCloseTo(3.096, 12)
    expect(r.energy).toBeCloseTo(4.792608, 12)
  })

  it('without a charge only the projectile carries momentum', () => {
    const r = freeRecoil({
      firearmMass: 5,
      projectileMass: 0.02,
      chargeMass: 0,
      muzzleVelocity: 500,
      gasFactor: 1.75,
    })
    expect(r.momentum).toBeCloseTo(10, 12)
    expect(r.energy).toBeCloseTo(10, 12)
  })

  it('reproduces the SAAMI worked example in SI', () => {
    // 7 lb gun, 589.9 gr ejecta, 33.4 gr charge, 1275 ft/s, factor 1.5, with 1 lb = 0.45359237 kg,
    // 1 gr = 64.79891 mg, 1 ft = 0.3048 m, 1 ft lbf = 1.3558179483 J.
    // Recoil velocity 816000 / 49000 = 16.653 ft/s (the sheet prints 16.65). Energy 30.168 ft lbf:
    // the sheet prints 30.22 because it rounds 7 / 64.34 to 0.109.
    const lb = 0.45359237
    const gr = 64.79891e-6
    const ft = 0.3048
    const r = freeRecoil({
      firearmMass: 7 * lb,
      projectileMass: 589.9 * gr,
      chargeMass: 33.4 * gr,
      muzzleVelocity: 1275 * ft,
      gasFactor: 1.5,
    })
    expect(r.velocity / ft).toBeCloseTo(816000 / 49000, 9)
    expect(r.energy / 1.3558179483).toBeCloseTo(30.168, 3)
  })

  it('rejects values outside the model', () => {
    const ok = {
      firearmMass: 4,
      projectileMass: 0.01,
      chargeMass: 0.003,
      muzzleVelocity: 800,
      gasFactor: 1.75,
    }
    expect(() => freeRecoil({ ...ok, firearmMass: 0 })).toThrow(InputError)
    expect(() => freeRecoil({ ...ok, projectileMass: -1 })).toThrow(InputError)
    expect(() => freeRecoil({ ...ok, chargeMass: -0.001 })).toThrow(InputError)
    expect(() => freeRecoil({ ...ok, muzzleVelocity: Number.NaN })).toThrow(InputError)
    expect(() => freeRecoil({ ...ok, gasFactor: -1 })).toThrow(InputError)
  })
})
