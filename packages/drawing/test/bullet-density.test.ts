import { describe, expect, it } from 'vitest'
import {
  copperDensity,
  jacketedDensity,
  leadDensity,
  materialClass,
  outlineDensity,
} from '../src/bullet/index.ts'
import { defined } from './defined.ts'

const provenance = { sources: [{ title: 'fixture' }] }
const q = (value: number) => ({ value })

/** Missouri Bullet 309115RN (#1 Carbine, 115 gr RN): cast, 7.452 g, 7.849 by 17.25 mm. */
const castRoundNose = {
  diameter: q(7.849),
  length: q(17.25),
  mass: q(7.452),
  construction: { structure: 'cast', core: { material: 'lead-alloy' } },
  provenance,
}

/** Hammer .172 18 gr Dead Blow Hammer: monolithic copper, 1.166 g, 4.369 by 12.7 mm. */
const copperSpitzer = {
  diameter: q(4.369),
  length: q(12.7),
  mass: q(1.166),
  construction: { structure: 'monolithic' },
  provenance,
}

describe('outlineDensity', () => {
  it('flags a cast round nose whose outline is too small for its mass', () => {
    const o = defined(outlineDensity(castRoundNose))
    expect(o.material).toBe('lead')
    expect(o.bound).toBe(leadDensity)
    expect(o.density).toBeGreaterThan(leadDensity)
    expect(o.exceeds).toBe(true)
  })

  it('passes a copper bullet below the copper density', () => {
    const o = defined(outlineDensity(copperSpitzer))
    expect(o.material).toBe('copper')
    expect(o.bound).toBe(copperDensity)
    expect(o.density).toBeLessThan(copperDensity)
    expect(o.exceeds).toBe(false)
  })

  it('takes the mass over the outline volume in g/cm3', () => {
    // A flat-nosed cylinder with no nose: the volume is pi d^2 L / 4.
    const cylinder = {
      diameter: q(10),
      length: q(10),
      noseLength: q(1e-6),
      meplatDiameter: q(10 - 1e-6),
      mass: q(7.854),
      construction: { structure: 'cast' },
      provenance,
    }
    expect(defined(outlineDensity(cylinder)).density).toBeCloseTo(10, 2)
  })

  it('gives no density without a length, a diameter or a material class', () => {
    expect(outlineDensity({ ...castRoundNose, length: undefined })).toBeUndefined()
    expect(outlineDensity({ ...castRoundNose, construction: undefined })).toBeUndefined()
    expect(
      outlineDensity({ ...castRoundNose, construction: { structure: 'cast', unmapped: true } }),
    ).toBeUndefined()
  })
})

describe('materialClass', () => {
  it('reads the class from the structure, the jacket and the core', () => {
    expect(materialClass({ structure: 'cast' })).toBe('lead')
    expect(materialClass({ structure: 'plated' })).toBe('lead')
    expect(materialClass({ core: { material: 'lead' } })).toBe('lead')
    expect(materialClass({ structure: 'monolithic' })).toBe('copper')
    expect(materialClass({ core: { material: 'copper-alloy' } })).toBe('copper')
    expect(materialClass({ core: { material: 'lead' }, jacket: {} })).toBe('jacketed')
    expect(materialClass({ structure: 'bonded' })).toBe('jacketed')
    expect(materialClass({ core: { material: 'tungsten' } })).toBeUndefined()
    expect(materialClass(undefined)).toBeUndefined()
  })
})

describe('jacketedDensity', () => {
  it('lies between copper and lead and falls with the jacket share', () => {
    expect(jacketedDensity(0)).toBeCloseTo(leadDensity, 10)
    expect(jacketedDensity(1)).toBeCloseTo(copperDensity, 10)
    expect(jacketedDensity(0.1)).toBeCloseTo(11.05, 2)
    expect(jacketedDensity(0.35)).toBeCloseTo(10.37, 2)
  })
})
