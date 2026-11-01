import { describe, expect, it } from 'vitest'
import { bulletListFields } from '../src/index.ts'

describe('bulletListFields', () => {
  it('takes the structure, else the core material as <material>-core, else none', () => {
    const of = (construction: Parameters<typeof bulletListFields>[0]['construction']) =>
      bulletListFields({ construction }).construction
    expect(of({ raw: 'x', structure: 'monolithic', core: { material: 'copper' } })).toBe(
      'monolithic',
    )
    expect(of({ raw: 'x', core: { material: 'lead' } })).toBe('lead-core')
    expect(of({ raw: 'x', jacket: { material: 'copper' } })).toBeUndefined()
    expect(of(undefined)).toBeUndefined()
  })

  it('gives lead-free true, false or undefined as leadFree', () => {
    const free = (material: 'copper' | 'lead') =>
      bulletListFields({ construction: { raw: 'x', core: { material } } }).leadFree
    expect(free('copper')).toBe(true)
    expect(free('lead')).toBe(false)
    expect(bulletListFields({}).leadFree).toBeUndefined()
  })

  it('takes the first G1 and G7 of a banded list, null without one, and the tip and base type', () => {
    const banded = bulletListFields({
      ballisticCoefficients: [
        { dragModel: 'G1', value: 0.5, minVelocity: { value: 2800 } },
        { dragModel: 'G1', value: 0.48, minVelocity: { value: 2000 } },
        { dragModel: 'G7', value: 0.25 },
        { dragModel: 'G7', value: 0.24 },
      ],
      tip: { type: 'hollow-point' },
      base: { type: 'boat-tail' },
    })
    expect(banded).toEqual({
      ballisticCoefficientG1: 0.5,
      ballisticCoefficientG7: 0.25,
      tipType: 'hollow-point',
      baseType: 'boat-tail',
      construction: undefined,
      leadFree: undefined,
    })
    const none = bulletListFields({})
    expect(none.ballisticCoefficientG1).toBeNull()
    expect(none.ballisticCoefficientG7).toBeNull()
    expect(none.tipType).toBeUndefined()
    expect(none.baseType).toBeUndefined()
  })
})
