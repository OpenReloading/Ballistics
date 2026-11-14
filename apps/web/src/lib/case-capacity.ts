import { loadWaterCapacity } from '@rangefoundry/schema'
import { msg } from '../i18n/translate.ts'

/** The Cartridge card's measured case capacity, for the unit switch (the field is the preview's). */
export const measuredWaterCapacitySpec = {
  key: 'measuredWaterCapacity',
  label: msg('Case capacity (H₂O)'),
  quantity: 'capacity',
  min: 0,
} as const

/** A capacity record as the cartridge's record lists it. */
type Recorded = { id: string; waterCapacity: { value: number } }

/** The water (g) the case volume is read from, where it comes from and the capacity record it is when it is one. */
export interface UsedWater<T extends Recorded = Recorded> {
  grams: number
  source: 'measured' | 'capacity' | 'case'
  record?: T
}

/** Water in g: the measured value, else the capacity record chosen, else the case record's stated capacity, else the cartridge's first capacity record. */
export function usedWater<T extends Recorded>(o: {
  measured?: number | undefined
  capacities: readonly T[]
  capacityId?: string | undefined
  stated?: number | undefined
  /** A case record is chosen but not read yet: its capacity is not known, so no other record stands in for it. */
  pendingCase?: boolean | undefined
}): UsedWater<T> | undefined {
  if (o.measured !== undefined) return { grams: o.measured, source: 'measured' }
  const chosen = o.capacities.find((c) => c.id === o.capacityId)
  const capacity =
    chosen ?? (o.stated === undefined && !o.pendingCase ? o.capacities[0] : undefined)
  const water = loadWaterCapacity({
    capacity,
    case: o.stated === undefined ? undefined : { waterCapacity: { value: o.stated } },
  })
  return water && { ...water, ...(capacity && { record: capacity }) }
}
