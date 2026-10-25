import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  findManufacturer,
  knownManufacturers,
  manufacturerNames,
  newManufacturerRecord,
  referTo,
  refName,
  withUserManufacturers,
} from '../src/lib/manufacturers.ts'

const uuid = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const catalogue = [
  { id: 'alpha-powder', name: 'Alpha Powder', aliases: ['Alpha Pulver'] },
  { id: 'beta', name: 'Beta' },
]
const mine: UserRecord[] = [newManufacturerRecord(uuid, '  Home Loader ', new Date(0))]

describe('user manufacturers', () => {
  it('creates a record with the trimmed name and the user origin', () => {
    expect(mine[0]).toMatchObject({
      kind: 'manufacturer',
      id: uuid,
      name: 'Home Loader',
      data: { origin: 'user' },
    })
  })

  it('finds a typed name among catalogue and user manufacturers, by name or alias', () => {
    const known = knownManufacturers(catalogue, mine)
    expect(findManufacturer(known, 'alpha  powder')?.ref).toBe('catalogue:alpha-powder')
    expect(findManufacturer(known, 'ALPHA-PULVER')?.ref).toBe('catalogue:alpha-powder')
    expect(findManufacturer(known, 'home loader')?.ref).toBe(`user:${uuid}`)
    expect(findManufacturer(known, 'Gamma')).toBeUndefined()
    expect(findManufacturer(known, '  ')).toBeUndefined()
  })

  it('finds a catalogue manufacturer before a user one of the same name', () => {
    const same = [newManufacturerRecord(uuid, 'Beta', new Date(0))]
    expect(findManufacturer(knownManufacturers(catalogue, same), 'beta')?.ref).toBe(
      'catalogue:beta',
    )
  })

  it('leaves out a user manufacturer whose id is no UUID, which no reference can name', () => {
    const old = [{ ...mine[0], id: 'old-id' } as UserRecord]
    expect(knownManufacturers([], old)).toEqual([])
  })

  it('creates a user manufacturer for a new name and finds it for the next', () => {
    let known = knownManufacturers(catalogue, [])
    const first = referTo(known, 'Home Loader', () => uuid, new Date(0))
    expect(first?.ref).toBe(`user:${uuid}`)
    expect(first?.created).toMatchObject({ kind: 'manufacturer', name: 'Home Loader' })
    known = knownManufacturers(catalogue, first?.created ? [first.created] : [])
    const again = referTo(known, ' home  loader', () => 'unused', new Date(0))
    expect(again).toEqual({ ref: `user:${uuid}` })
  })

  it('names a catalogue manufacturer without creating one, and nothing for an empty text', () => {
    const known = knownManufacturers(catalogue, [])
    expect(referTo(known, 'beta', () => uuid, new Date(0))).toEqual({ ref: 'catalogue:beta' })
    expect(referTo(known, ' ', () => uuid, new Date(0))).toBeUndefined()
  })

  it('names a reference of either scope', () => {
    const names = withUserManufacturers(manufacturerNames(catalogue), mine)
    expect(refName(names, 'catalogue:beta')).toBe('Beta')
    expect(refName(names, `user:${uuid}`)).toBe('Home Loader')
    expect(refName(names, 'catalogue:gone')).toBe('')
    expect(refName(names, undefined)).toBe('')
  })
})
