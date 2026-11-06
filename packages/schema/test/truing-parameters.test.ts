import { describe, expectTypeOf, it } from 'vitest'
import type { QuantityValue, Truing } from '../src/index.ts'

// `tsc -p test` (the package's typecheck) checks the types below

type Parameter = Truing['parameters'][number]
type Of<N extends Parameter['name']> = Extract<Parameter, { name: N }>

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
})
