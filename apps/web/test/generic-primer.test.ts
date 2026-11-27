import { describe, expect, it } from 'vitest'
import { genericPrimer } from '../src/lib/generic-primer.ts'

describe('the generic primer of a cartridge', () => {
  it('is the standard primer of the sourced size', () => {
    expect(genericPrimer({ defaults: { primerSize: 'small-pistol' } })).toMatchObject({
      size: 'small-pistol',
      magnum: false,
    })
  })

  it('is a magnum primer where the source calls for one', () => {
    expect(
      genericPrimer({ defaults: { primerSize: 'large-rifle', primerMagnum: true } }),
    ).toMatchObject({ size: 'large-rifle', magnum: true })
  })

  it('stays standard for a size without a magnum primer', () => {
    expect(
      genericPrimer({ defaults: { primerSize: 'shotshell', primerMagnum: true } }),
    ).toMatchObject({ size: 'shotshell', magnum: false })
  })

  it('is none without a sourced primer size', () => {
    expect(genericPrimer({ defaults: { capacity: 'catalogue:x' } })).toBeUndefined()
    expect(genericPrimer(undefined)).toBeUndefined()
  })
})
