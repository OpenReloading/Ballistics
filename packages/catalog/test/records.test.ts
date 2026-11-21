import { describe, expect, it } from 'vitest'
import { type Bundle, checkRecords } from '../src/records.ts'
import { bundle } from './bundle.ts'

/** The test bundle with case diameter P1 and case length L3 on alpha-rifle: its capacity must stay under 5.7 g. */
const sized: Bundle = {
  ...bundle,
  cartridges: bundle.cartridges.map((c) =>
    c.id === 'alpha-rifle'
      ? {
          ...c,
          values: [
            ...c.values,
            { side: 'cartridge', symbol: 'P1', quantity: 'length', value: 11.9 },
            { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51 },
          ],
        }
      : c,
  ),
}

/** The capacity errors of the sized bundle with the water capacity of its one capacity set to `grams`. */
const capacityErrors = (grams: number) =>
  checkRecords({
    bundle: {
      ...sized,
      capacities: sized.capacities.map((c) => ({ ...c, waterCapacity: { value: grams } })),
    },
    published: [],
    loadTables: {},
  }).errors.filter((e) => e.startsWith('capacities/'))

describe('checkRecords capacities', () => {
  it('checks a capacity against the cartridge its catalogue reference names', () => {
    expect(capacityErrors(3.6)).toEqual([])
    // 67.7 is a capacity in grains entered as grams
    expect(capacityErrors(67.7)).toEqual([
      'capacities/alpha-rifle-test.json: capacity-range: water capacity 67.7 g is outside 0 to 5.7 g (cylinder enclosing the case)',
    ])
  })
})
