import { loadWaterCapacity } from '@open-reloading/schema'

/** A capacity record as the cartridge's record lists it. */
type Recorded = { id: string; waterCapacity: { value: number } }

/** The water (g) the case volume is read from, where it comes from and the capacity record it is when it is one. */
export interface UsedWater<T extends Recorded = Recorded> {
  grams: number
  source: 'measured' | 'capacity' | 'case'
  record?: T
}

/**
 * The water the workbench takes as the case's capacity: the measured value typed (g), else the
 * capacity record chosen, else the stated capacity (g) of the case record chosen, else the first
 * capacity record of the cartridge.
 */
export function usedWater<T extends Recorded>(o: {
  measured?: number | undefined
  capacities: readonly T[]
  capacityId?: string | undefined
  stated?: number | undefined
}): UsedWater<T> | undefined {
  if (o.measured !== undefined) return { grams: o.measured, source: 'measured' }
  const chosen = o.capacities.find((c) => c.id === o.capacityId)
  const capacity = chosen ?? (o.stated === undefined ? o.capacities[0] : undefined)
  const water = loadWaterCapacity({
    capacity,
    case: o.stated === undefined ? undefined : { waterCapacity: { value: o.stated } },
  })
  return water && { ...water, ...(capacity && { record: capacity }) }
}
