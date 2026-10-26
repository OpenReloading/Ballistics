import { describe, expect, it } from 'vitest'
import { usedWater } from '../src/lib/case-capacity.ts'

const capacities = [
  { id: 'cap-a', waterCapacity: { value: 56 } },
  { id: 'cap-b', waterCapacity: { value: 57 } },
]

describe('the water a case holds in the workbench', () => {
  it('takes the measured value over everything', () => {
    expect(usedWater({ measured: 55.2, capacities, capacityId: 'cap-b', stated: 58 })).toEqual({
      grams: 55.2,
      source: 'measured',
    })
  })

  it('takes the capacity record chosen over the stated capacity of the case', () => {
    const used = usedWater({ capacities, capacityId: 'cap-b', stated: 58 })
    expect(used?.grams).toBe(57)
    expect(used?.source).toBe('capacity')
    expect(used?.record?.id).toBe('cap-b')
  })

  it('defaults to the stated capacity of the case without a measured value or a chosen record', () => {
    expect(usedWater({ capacities, stated: 58 })).toEqual({ grams: 58, source: 'case' })
    expect(usedWater({ capacities: [], stated: 58 })).toEqual({ grams: 58, source: 'case' })
  })

  it('keeps the first capacity record of the cartridge when no case states one', () => {
    expect(usedWater({ capacities })?.record?.id).toBe('cap-a')
    expect(usedWater({ capacities, capacityId: 'gone' })?.record?.id).toBe('cap-a')
  })

  it('has no water without any', () => {
    expect(usedWater({ capacities: [] })).toBeUndefined()
  })
})
