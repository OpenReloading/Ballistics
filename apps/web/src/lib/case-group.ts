import { type Case, parseRef, type UserRecord } from '@rangefoundry/schema'
import { measuredCapacityRef } from './load-record.ts'

/** A new group of cases: no cartridge yet, brass. */
export const blankCaseGroup = (): Case => ({
  origin: 'user',
  name: '',
  cartridge: '',
  material: 'brass',
})

/** The measured capacity (g) a group of cases names: its `capacity` record among `records`, else undefined. */
export function groupCapacity(c: Case, records: readonly UserRecord[]): number | undefined {
  const id = c.capacity && parseRef(c.capacity)?.id
  const r = records.find((x) => x.id === id)
  return r?.kind === 'caseCapacity' ? r.data.waterCapacity.value : undefined
}

/** `m3` in SI; the same record as the workbench's measured capacity, so a capacity is stored once, and without `m3` the reference stays, for a record this browser does not hold. */
export function withCapacity(c: Case, m3: number | undefined): Case {
  const { capacity: held, ...rest } = c
  if (!c.cartridge) return rest
  if (m3 === undefined) return held === undefined ? rest : c
  return { ...rest, capacity: measuredCapacityRef(c.cartridge, m3) }
}

/** A group of the user's cases as the workbench's case choice lists it. */
export interface OwnCase {
  id: string
  name: string
  /** The cartridge reference. */
  cartridge: string
  /** The reference of the measured capacity record the group names. */
  capacity?: string | undefined
  /** That capacity, g, when its record is in the browser. */
  grams?: number | undefined
  /** The measured trim length, mm. */
  trimLength?: number | undefined
  /** The standard deviation of the water capacity over the cases measured, g. */
  spread?: number | undefined
}

/** The groups of cases among `records`, with their measured capacity. */
export const ownCases = (records: readonly UserRecord[]): OwnCase[] =>
  records.flatMap((r) =>
    r.kind === 'case'
      ? [
          {
            id: r.id,
            name: r.name,
            cartridge: r.data.cartridge,
            capacity: r.data.capacity,
            grams: groupCapacity(r.data, records),
            trimLength: r.data.trimLength?.value,
            spread: r.data.spread?.value,
          },
        ]
      : [],
  )
