import { interiorBody } from '@open-reloading/api/compute'
import { describe, expect, it } from 'vitest'
import { cavityVolumeFraction } from '../src/lib/cavity-range.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorRequest } from '../src/lib/interior-request.ts'

describe('cavityVolumeFraction', () => {
  // made-up seating: 0.6 cm3 behind the bullet, 0.02 cm3 less at the deepest cavity, 0.05 cm3 more at the shallowest
  const range = { low: 0.58e-6, high: 0.65e-6 }

  it('adds the larger move over the bracket, relative to the volume, to the default 1 %', () => {
    expect(cavityVolumeFraction(range, 0.6e-6)).toBeCloseTo(0.01 + 0.05 / 0.6, 9)
    // a larger volume at the same bracket: a smaller share
    expect(cavityVolumeFraction({ low: 9.98e-6, high: 10.01e-6 }, 10e-6)).toBeCloseTo(
      0.01 + 0.02 / 10,
      9,
    )
  })

  it('gives none without a bracket (typed depth, solid base) or a volume', () => {
    expect(cavityVolumeFraction(undefined, 0.6e-6)).toBeUndefined()
    expect(cavityVolumeFraction(range, undefined)).toBeUndefined()
    expect(cavityVolumeFraction(range, 0)).toBeUndefined()
  })

  it('is capped at the 0.2 the API takes', () => {
    expect(cavityVolumeFraction({ low: 0.05e-6, high: 0.2e-6 }, 0.1e-6)).toBe(0.2)
  })
})

describe('interiorRequest', () => {
  it('sends the volume tolerance only when one is given, in a body the API takes', () => {
    const values = { ...exampleInterior, boreArea: undefined }
    const plain = interiorRequest({ values, powder: undefined, boreArea: 4.7e-5 })
    expect(plain.body.tolerances).toBeUndefined()
    const covered = interiorRequest({
      values,
      powder: undefined,
      boreArea: 4.7e-5,
      volumeFraction: 0.07,
    })
    expect(covered.body.tolerances).toEqual({ volumeFraction: 0.07 })
    expect(interiorBody.parse(covered.body).tolerances).toEqual({ volumeFraction: 0.07 })
  })
})
