import { describe, expect, expectTypeOf, it } from 'vitest'
import { type QuantityValue, type Truing, truing } from '../src/index.ts'

// `tsc -p test` (the package's typecheck) checks the types below and fails on a `@ts-expect-error` without an error

type Parameter = Truing['parameters'][number]
type Of<N extends Parameter['name']> = Extract<Parameter, { name: N }>

/** Each parameter with the value shape of another one: its type refuses it, and so does parsing. */
const wrongShape: { [N in Parameter['name']]: Of<N> } = {
  muzzleVelocity: {
    name: 'muzzleVelocity',
    status: 'identified',
    reasons: [],
    // @ts-expect-error -- a muzzle velocity is a quantity, not a number
    value: 790,
  },
  dragFactor: {
    name: 'dragFactor',
    status: 'identified',
    reasons: [],
    // @ts-expect-error -- a drag factor is a number, not a quantity
    value: { value: 1.03 },
  },
  clickValue: {
    name: 'clickValue',
    status: 'identified',
    reasons: [],
    // @ts-expect-error -- a click value is a quantity, not a number
    lower: 0.0057,
  },
  zeroOffset: {
    name: 'zeroOffset',
    status: 'identified',
    reasons: [],
    // @ts-expect-error -- a zero offset is a quantity, not a number
    upper: 0.0001,
  },
}

describe('truing parameter values', () => {
  it('have the one shape of their name', () => {
    expectTypeOf<Of<'dragFactor'>['value']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Of<'dragFactor'>['lower']>().toEqualTypeOf<number | undefined>()
    expectTypeOf<Of<'dragFactor'>['upper']>().toEqualTypeOf<number | undefined>()
    // a union: one of the three with a number in it would show in the union
    type Quantities = Of<'muzzleVelocity' | 'clickValue' | 'zeroOffset'>
    expectTypeOf<Quantities['value']>().toEqualTypeOf<QuantityValue | undefined>()
    expectTypeOf<Quantities['lower']>().toEqualTypeOf<QuantityValue | undefined>()
    expectTypeOf<Quantities['upper']>().toEqualTypeOf<QuantityValue | undefined>()
  })

  it.each(Object.values(wrongShape))('refuse the shape of another name when parsed: $name', (p) => {
    expect(truing.shape.parameters.element.safeParse(p).success).toBe(false)
  })
})
