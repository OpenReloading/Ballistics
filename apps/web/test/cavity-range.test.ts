import { interiorBody } from '@open-reloading/api/compute'
import type { Bullet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { cavityVolumeFraction } from '../src/lib/cavity-range.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorRequest } from '../src/lib/interior-request.ts'

/** A 9 mm hollow base wadcutter: a cavity of 6 mm opening, depth assumed 3 mm. */
const wadcutter = (cavityDepth?: number): Partial<Bullet> => ({
  diameter: { value: 9 },
  length: { value: 15 },
  mass: { value: 9.5 },
  base: {
    type: 'conical-hollow-base',
    cavityDiameter: { value: 6 },
    ...(cavityDepth !== undefined && { cavityDepth: { value: cavityDepth } }),
  },
  provenance: { kind: 'published', sources: [{ title: 'fixture' }] },
})

describe('cavityVolumeFraction', () => {
  it('reaches the cone at three times the assumed depth: pi r^3 less pi r^3 / 3', () => {
    // seated 10 mm deep, 0.6 cm3 behind the bullet
    const f = cavityVolumeFraction(wadcutter(), 10e-3, 0.6e-6)
    const r = 3
    const move = Math.PI * r ** 3 - (Math.PI * r ** 3) / 3
    expect(f).toBeCloseTo(move / 1e9 / 0.6e-6, 6)
  })

  it('gives none for a typed depth, a solid base or a move below the default tolerance', () => {
    expect(cavityVolumeFraction(wadcutter(4), 10e-3, 0.6e-6)).toBeUndefined()
    expect(
      cavityVolumeFraction({ ...wadcutter(), base: { type: 'flat' } }, 10e-3, 0.6e-6),
    ).toBeUndefined()
    // a large case: the move is below 1 % of the volume
    expect(cavityVolumeFraction(wadcutter(), 10e-3, 10e-6)).toBeUndefined()
    expect(cavityVolumeFraction(wadcutter(), undefined, 0.6e-6)).toBeUndefined()
  })

  it('is capped at the 0.2 the API takes', () => {
    expect(cavityVolumeFraction(wadcutter(), 10e-3, 0.1e-6)).toBe(0.2)
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
