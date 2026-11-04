import * as fc from 'fast-check'
import { expect, expectTypeOf, it } from 'vitest'
import {
  conversions,
  fromSi,
  type QuantityKind,
  type Si,
  type Stored,
  siMaps,
  toSi,
  type UnitId,
  units,
} from '../src/index.ts'

const kinds = Object.keys(units) as QuantityKind[]

it('maps every quantity kind through the conversion of its stored unit', () => {
  expect(Object.keys(siMaps)).toEqual(kinds)
  for (const kind of kinds) expect(siMaps[kind]).toBe(conversions[units[kind]])
})

it('has a finite, positive factor and a finite offset for every unit', () => {
  for (const { factor, offset } of Object.values(conversions)) {
    expect(factor).toBeGreaterThan(0)
    expect(Number.isFinite(factor) && Number.isFinite(offset)).toBe(true)
  }
})

it.each<[UnitId, number]>([
  ['in', 0.0254],
  ['ft', 0.3048],
  ['gr', 6.479891e-5],
  ['mph', 0.44704],
  ['psi', 6894.757293168],
  ['lb/in2', 703.0695796],
  ['MOA', Math.PI / 180 / 60],
  ['inHg', 3386.389],
])('converts 1 %s to SI as the exact definition', (unit, si) => {
  expect(conversions[unit].factor).toBeCloseTo(si, 7)
})

it('round-trips every quantity kind between stored unit and SI', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...kinds),
      fc.double({ min: -1e9, max: 1e9, noNaN: true }),
      (kind, x) => {
        const back = fromSi(kind, toSi(kind, x))
        const scale = Math.max(1, Math.abs(x), siMaps[kind].offset / siMaps[kind].factor)
        expect(Math.abs(back - x)).toBeLessThanOrEqual(1e-12 * scale)
      },
    ),
  )
})

it('marks stored and SI values per quantity kind for the type checker', () => {
  expectTypeOf(toSi('length', 1)).toEqualTypeOf<Si<'length'>>()
  expectTypeOf(fromSi('mass', 1)).toEqualTypeOf<Stored<'mass'>>()
  expectTypeOf<Si<'length'>>().toExtend<number>()
  expectTypeOf<Si<'length'>>().not.toExtend<Si<'mass'>>()
  expectTypeOf<Si<'length'>>().not.toExtend<Stored<'length'>>()
  expectTypeOf<number>().not.toExtend<Si<'length'>>()
})

it('refuses a value that already has the unit a conversion produces', () => {
  type ToSiInput = Parameters<typeof toSi<'length'>>[1]
  type FromSiInput = Parameters<typeof fromSi<'length'>>[1]
  expectTypeOf<number>().toExtend<ToSiInput>()
  expectTypeOf<Stored<'length'>>().toExtend<ToSiInput>()
  expectTypeOf<Si<'length'>>().not.toExtend<ToSiInput>()
  expectTypeOf<number>().toExtend<FromSiInput>()
  expectTypeOf<Si<'length'>>().toExtend<FromSiInput>()
  expectTypeOf<Stored<'length'>>().not.toExtend<FromSiInput>()
})

it('refuses a value branded for another quantity kind', () => {
  expectTypeOf<Stored<'mass'>>().not.toExtend<Parameters<typeof toSi<'length'>>[1]>()
  expectTypeOf<Si<'mass'>>().not.toExtend<Parameters<typeof fromSi<'length'>>[1]>()
  // @ts-expect-error -- a mass is no length, and `kind` alone sets the kind
  toSi('length', fromSi('mass', 1))
  // @ts-expect-error -- a mass is no length, and `kind` alone sets the kind
  fromSi('length', toSi('mass', 1))
})
