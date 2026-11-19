import { describe, expect, it } from 'vitest'
import { cylinderGapLeakage, type InteriorLoad, interior } from '../src/index.ts'

const lands = 8.84e-3
const groove = 9.07e-3

/** A .357 Magnum like load, made-up numbers: 158 gr bullet, COAL 40.0 mm under L6 40.39 mm, 95 mm barrel from the forcing cone. */
const magnum = (travel: number): InteriorLoad => ({
  chamber: {
    volume: 1.2e-6,
    boreArea: (Math.PI / 4) * ((lands + groove) / 2) ** 2,
    boreDiameter: lands,
  },
  barrel: { length: travel, twist: 0.4699 },
  bullet: { mass: 0.01024 },
  charge: 0.00094,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1 / 1600,
    burn: {
      kind: 'vivacity',
      vivacity: 1.5,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'constant' },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 1e6,
  startPressure: 0,
})

/** Travel 95 mm + cylinder face 40.39 mm + gap - base 24 mm; the base passes the face at 16.39 mm. */
const travelWith = (gap: number) => 0.095 + 0.04039 + gap - 0.024
const exit = 0.01639

const run = (load: InteriorLoad) => {
  const r = interior(load)
  if (!r.valid) throw new Error(r.reason)
  return r
}

describe('cylinderGapLeakage (apps/docs/docs/models/interior-leakage-heat.md, "Cylinder gap")', () => {
  it('opens pi d g over the gap from where the base leaves the cylinder', () => {
    const leak = cylinderGapLeakage({ boreDiameter: lands, gap: 1e-4, exit, travel: 0.11149 })
    expect(leak?.area).toEqual([
      { travel: 0.01639, area: 0 },
      { travel: expect.closeTo(0.01649, 12), area: expect.closeTo(2.77717e-6, 11) },
      { travel: 0.11149, area: expect.closeTo(2.77717e-6, 11) },
    ])
  })

  it('gives no leak for a gap of 0 or one the base does not cross before the muzzle', () => {
    expect(cylinderGapLeakage({ boreDiameter: lands, gap: 0, exit, travel: 0.1 })).toBeUndefined()
    expect(
      cylinderGapLeakage({ boreDiameter: lands, gap: 1e-4, exit: 0.1, travel: 0.1 }),
    ).toBeUndefined()
  })

  it('a 0.10 mm gap costs the .357 load 2.4 % velocity at Cd 0.7 and 3.4 % at Cd 1, the peak unchanged', () => {
    const none = run(magnum(travelWith(0)))
    const travel = travelWith(1e-4)
    const leak = cylinderGapLeakage({ boreDiameter: lands, gap: 1e-4, exit, travel })
    if (!leak) throw new Error('no leak')
    const gap = run({ ...magnum(travel), leakage: leak })
    const full = run({ ...magnum(travel), leakage: { ...leak, discharge: 1 } })
    expect(gap.muzzleVelocity / none.muzzleVelocity - 1).toBeCloseTo(-0.0237, 4)
    expect(full.muzzleVelocity / none.muzzleVelocity - 1).toBeCloseTo(-0.0337, 4)
    // the peak lies at 12.9 mm of travel, before the base reaches the face at 16.39 mm
    expect(gap.peakBreechPressure / none.peakBreechPressure).toBeCloseTo(1, 9)
  })

  it('a gap the base reaches before the peak lowers the peak', () => {
    const none = run(magnum(travelWith(0)))
    const travel = travelWith(1e-4)
    const leak = cylinderGapLeakage({ boreDiameter: lands, gap: 1e-4, exit: 0.007, travel })
    if (!leak) throw new Error('no leak')
    const early = run({ ...magnum(travel), leakage: leak })
    expect(early.peakBreechPressure / none.peakBreechPressure - 1).toBeCloseTo(-0.0457, 4)
  })
})
