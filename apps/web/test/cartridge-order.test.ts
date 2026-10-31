import { expect, it } from 'vitest'
import {
  type CartridgeRow,
  cartridgeRank,
  compareCartridgeNames,
} from '../src/lib/cartridge-rows.ts'

const row = (name: string, aliases: string[] = []) => ({ name, aliases }) as CartridgeRow

it('orders a leading number by value, a decimal comma as a point', () => {
  const names = ['5,75 Velodog', '5,7 x 28', '5,6 x 57 R', '5,56 mm FX', '5,45 x 39', '5,45 x 18']
  expect(names.toSorted(compareCartridgeNames)).toEqual([
    '5,45 x 18',
    '5,45 x 39',
    '5,56 mm FX',
    '5,6 x 57 R',
    '5,7 x 28',
    '5,75 Velodog',
  ])
})

it('puts numbered names before the others and orders the rest with numbers by value', () => {
  expect(['Tubb 10', '7,62 x 39', 'Tubb 9', '4 Bore'].toSorted(compareCartridgeNames)).toEqual([
    '4 Bore',
    '7,62 x 39',
    'Tubb 9',
    'Tubb 10',
  ])
})

it('ranks the name typed in full, then its start, then the start of an alias', () => {
  expect(cartridgeRank(row('308 Win.'), '308 win')).toBe(3)
  expect(cartridgeRank(row('308 Win.'), '308')).toBe(2)
  expect(cartridgeRank(row('7,5 FK', ['308 Swiss']), '308')).toBe(1)
  expect(cartridgeRank(row('7,5 FK'), '308')).toBe(0)
})
