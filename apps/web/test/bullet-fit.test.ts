import { describe, expect, it } from 'vitest'
import type { CartridgeSummary } from '../src/lib/api-types.ts'
import { fitOf, fitsOf, summaryFitSource } from '../src/lib/bullet-fit.ts'

const summary = (
  id: string,
  name: string,
  fit: { g1?: number; land?: number; groove?: number },
): CartridgeSummary => ({
  id,
  name,
  aliases: [],
  table: 'I',
  maxBulletDiameter: fit.g1,
  boreDiameter: fit.land,
  grooveDiameter: fit.groove,
})

// C.I.P. G1, F and Z in mm
const win308 = summary('308-win', '308 Win.', { g1: 7.85, land: 7.62, groove: 7.82 })
const british = summary('303-british', '303 British', { g1: 7.92, land: 7.7, groove: 7.98 })
const suisse = summary('7-5-x-55-suisse', '7,5 x 55 Suisse', { g1: 7.78, land: 7.51, groove: 7.77 })

describe('fitOf', () => {
  it('is undefined without a choice or with any of the three values missing', () => {
    expect(fitOf(undefined)).toBeUndefined()
    expect(fitOf({ land: 7.62, groove: 7.82 })).toBeUndefined()
    expect(fitOf({ g1: 7.85, groove: 7.82 })).toBeUndefined()
    expect(fitOf({ g1: 7.85, land: 7.62 })).toBeUndefined()
  })

  it('keeps a value of zero', () => {
    expect(fitOf({ g1: 0, land: 0, groove: 0 })).toEqual({ g1: 0, land: 0, groove: 0 })
  })
})

describe('summaryFitSource', () => {
  it('reads G1, F and Z of a list summary', () => {
    expect(fitOf(summaryFitSource(win308))).toEqual({ g1: 7.85, land: 7.62, groove: 7.82 })
    expect(fitOf(summaryFitSource(summary('x', 'X', { g1: 7.85, groove: 7.82 })))).toBeUndefined()
  })
})

describe('fitsOf', () => {
  const cartridges = [win308, british, suisse]

  it('lists a .308 bullet (7.823 mm) in 308 Win. only: over the middle of F and Z, up to G1', () => {
    expect(fitsOf(7.823, cartridges)).toEqual([{ id: '308-win', name: '308 Win.' }])
  })

  it('fits at G1 and its printed rounding, not above, and not at the middle of F and Z', () => {
    expect(fitsOf(7.855, [win308])).toHaveLength(1)
    expect(fitsOf(7.856, [win308])).toHaveLength(0)
    expect(fitsOf(7.72, [win308])).toHaveLength(0)
    expect(fitsOf(7.721, [win308])).toHaveLength(1)
  })

  it('skips a cartridge without all three values', () => {
    expect(fitsOf(7.823, [summary('no-f', 'No F', { g1: 7.85, groove: 7.82 })])).toEqual([])
  })
})
