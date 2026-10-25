import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  findManufacturer,
  knownManufacturers,
  manufacturerNames,
  manufacturerUses,
  newManufacturerRecord,
  referTo,
  refName,
  withUserManufacturers,
} from '../src/lib/manufacturers.ts'
import { validRecords } from '../src/lib/user-data.ts'

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

  it('creates no user manufacturer while the catalogue is unknown, but still names a known one', () => {
    const known = knownManufacturers([], mine)
    const typed = (text: string) => referTo(known, text, () => uuid, new Date(0), false)
    expect(typed('Alpha Powder')).toBeUndefined()
    expect(typed('home loader')).toEqual({ ref: `user:${uuid}` })
    expect(
      referTo(knownManufacturers(catalogue, []), 'Alpha Powder', () => uuid, new Date(0), true),
    ).toEqual({ ref: 'catalogue:alpha-powder' })
  })

  it('names a reference of either scope', () => {
    const names = withUserManufacturers(manufacturerNames(catalogue), mine)
    expect(refName(names, 'catalogue:beta')).toBe('Beta')
    expect(refName(names, `user:${uuid}`)).toBe('Home Loader')
    expect(refName(names, 'catalogue:gone')).toBe('')
    expect(refName(names, undefined)).toBe('')
  })
})

describe('manufacturerUses', () => {
  const other = '0a1b2c3d-0000-4000-8000-000000000001'
  const third = '0a1b2c3d-0000-4000-8000-000000000002'
  const makers = [
    newManufacturerRecord(uuid, 'Home Loader', new Date(0)),
    newManufacturerRecord(other, 'Another', new Date(0)),
    newManufacturerRecord(third, 'Third', new Date(0)),
  ]
  const bullet = {
    kind: 'bullet',
    id: 'b1',
    name: 'Bullet',
    saved: '2026-10-13T10:00:00.000Z',
    data: { origin: 'user', manufacturer: `user:${uuid}` },
  } as UserRecord
  const uses = (
    records: UserRecord[],
    invalid: ReturnType<typeof validRecords>['invalid'] = [],
    shown: string[] = [],
  ) => manufacturerUses(records, invalid, shown).map((m) => [m.record.name, m.uses])

  it('counts the records that name a manufacturer, by name, and the unused ones as 0', () => {
    const gun = {
      ...bullet,
      kind: 'firearm',
      id: 'f1',
      data: { origin: 'user', manufacturer: `user:${uuid}` },
    } as unknown as UserRecord
    const capacity = {
      ...bullet,
      kind: 'caseCapacity',
      id: 'c1',
      data: { origin: 'user', caseManufacturer: `user:${other}` },
    } as unknown as UserRecord
    expect(uses([...makers, bullet, gun, capacity])).toEqual([
      ['Another', 1],
      ['Home Loader', 2],
      ['Third', 0],
    ])
  })

  it('does not count a catalogue manufacturer or a record of another maker as a use', () => {
    const catalogueBullet = {
      ...bullet,
      data: { origin: 'user', manufacturer: 'catalogue:beta' },
    } as UserRecord
    expect(uses([...makers, catalogueBullet])).toEqual([
      ['Another', 0],
      ['Home Loader', 0],
      ['Third', 0],
    ])
  })

  it('counts a record the format rejects that holds the reference, and an open field', () => {
    const rejected = validRecords([
      { kind: 'bullet', id: 'old', name: 'Old', data: { manufacturer: `user:${other}`, x: 1 } },
    ]).invalid
    expect(rejected).toHaveLength(1)
    expect(uses(makers, rejected, [`user:${third}`])).toEqual([
      ['Another', 1],
      ['Home Loader', 0],
      ['Third', 1],
    ])
  })
})
