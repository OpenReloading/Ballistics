import { describe, expect, it } from 'vitest'
import {
  analysisKinds,
  checkUserRefs,
  type Load,
  load,
  type QuantityKind,
  units,
  userDataFile,
  userDataFormat,
  userDataVersion,
  userRecord,
} from '../src/index.ts'
import { expectIssueAt, issuePaths } from './issue-at.ts'

const saved = '2026-10-13T10:00:00.000Z'
const uuid = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const other = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const userLoad = {
  origin: 'user',
  cartridge: 'catalogue:308-win',
  firearm: `user:${uuid}`,
  bullet: `user:${other}`,
  powder: 'catalogue:example-a-fast',
  charge: { value: 2.8 },
  seating: { by: 'overallLength', value: { value: 70.8 } },
  case: { waterCapacity: { value: 3.52 } },
  note: 'Seated 0.1 mm off the lands.',
  analysis: {
    overrides: { twist: 305, propellantTemperature: 21, vivacity: 0.55 },
    ladder: { kind: 'charge', stepCount: 5, step: 0.1, direction: 'around' },
  },
} as const
const catalogueLoad = {
  id: 'example-load',
  origin: 'catalogue',
  name: 'Example load',
  cartridge: 'catalogue:308-win',
  bullet: 'catalogue:example-a-1',
  powder: 'catalogue:example-a-fast',
  charge: { value: 2.8 },
  provenance: { kind: 'published', sources: [{ title: 'Example manual' }] },
} as const
const wrap = (data: object, kind = 'load') => ({
  kind,
  id: 'l1',
  name: 'Load',
  saved,
  data,
})

describe('Load', () => {
  it('is one schema for a catalogue record, a user record and the load file', () => {
    expect(load.safeParse(catalogueLoad).success).toBe(true)
    expect(load.safeParse(userLoad).success).toBe(true)
    const file = (data: object) => ({
      format: userDataFormat,
      version: userDataVersion,
      records: [wrap(data)],
    })
    for (const data of [userLoad, catalogueLoad, { ...userLoad, origin: 'shared' }]) {
      const parsed = userDataFile.parse(file(data))
      expect(parsed.records[0].data).toEqual(load.parse(data))
    }
    expect(userRecord.parse(wrap(userLoad)).data).toEqual(userLoad)
  })

  it('keeps a user load through a round trip and takes one without references', () => {
    expect(load.parse(userLoad)).toEqual(userLoad)
    const bare = { origin: 'user' }
    expect(load.parse(bare)).toEqual(bare)
  })

  it('keeps one stored unit per override key', () => {
    const kinds = Object.values(analysisKinds) as QuantityKind[]
    for (const kind of kinds) expect(units[kind]).toBeTruthy()
    expect(Object.keys(analysisKinds)).not.toContain('charge')
  })

  it('rejects a key under overrides that is no workbench value', () => {
    for (const key of ['charge', 'siValues', 'extra'])
      expectIssueAt(
        load,
        { ...userLoad, analysis: { overrides: { [key]: 1 } } },
        'analysis.overrides',
      )
    expectIssueAt(load, { ...userLoad, analysis: { overrides: { twist: '305' } } }, 'analysis')
  })

  it('needs an id, provenance, cartridge, bullet, powder and charge in a catalogue load', () => {
    for (const k of ['id', 'name', 'provenance', 'cartridge', 'bullet', 'powder', 'charge'])
      expectIssueAt(load, { ...catalogueLoad, [k]: undefined }, k)
  })

  it('names records only: a user record is no catalogue record, a description is measured data', () => {
    expectIssueAt(load, { ...catalogueLoad, bullet: `user:${uuid}` }, 'bullet')
    expectIssueAt(load, { ...catalogueLoad, powder: `user:${uuid}` }, 'powder')
    const description = {
      bullet: { manufacturerName: 'Maker', model: 'FMJ', bulletMass: { value: 10 } },
      powder: { manufacturerName: 'Maker', name: 'Fast' },
    }
    expectIssueAt(load, { ...catalogueLoad, ...description }, 'bullet')
    expectIssueAt(load, { ...userLoad, ...description }, 'powder')
    const measured = {
      ...catalogueLoad,
      ...description,
      provenance: { kind: 'measured', sources: [{ title: 'Own measurement' }] },
    }
    expect(issuePaths(load, measured)).toEqual([])
  })

  it('keeps the ladder: counts, steps and directions', () => {
    const withLadder = (ladder: unknown) => ({ ...userLoad, analysis: { ladder } })
    for (const ladder of [
      { stepCount: 21, direction: 'around' },
      { kind: 'seating', stepCount: 3, step: 0.5, direction: 'up' },
      { kind: 'temperature', stepCount: 2, step: 5, direction: 'down' },
    ])
      expect(load.parse(withLadder(ladder))).toEqual(withLadder(ladder))
    for (const ladder of [
      { stepCount: 1, direction: 'up' },
      { stepCount: 22, direction: 'up' },
      { stepCount: 4, direction: 'around' },
      { stepCount: 3, step: 0, direction: 'up' },
      { stepCount: 3, direction: 'sideways' },
      { kind: 'Seating', stepCount: 3, direction: 'up' },
    ])
      expectIssueAt(load, withLadder(ladder), 'analysis.ladder')
  })

  it('rejects a charge, capacity or seating of 0 and an unknown seating mode', () => {
    for (const data of [
      { charge: { value: 0 } },
      { case: { waterCapacity: { value: 0 } } },
      { seating: { by: 'overallLength', value: { value: 0 } } },
      { seating: { by: 'depth', value: { value: 70 } } },
      { cartridge: '308-win' },
      { firearm: 'f5' },
    ])
      expect(issuePaths(load, { ...userLoad, ...data })).not.toEqual([])
  })

  it('keeps the measured series in stored units', () => {
    const series = {
      name: 'day1.csv',
      date: '2026-10-12',
      device: 'Radar',
      muzzleDistance: { value: 3000 },
      strings: [
        {
          label: 'A',
          charge: { value: 2.48 },
          shots: [{ velocity: { value: 800 } }, { velocity: { value: 790 }, excluded: 'flyer' }],
        },
        { shots: [{ velocity: { value: 810, raw: '2657' }, coldBore: true }] },
      ],
    }
    const measurements = [series, { name: 'day2.csv', strings: [] }]
    expect(load.parse({ ...userLoad, measurements })).toEqual({ ...userLoad, measurements })
    expectIssueAt(
      load,
      { ...userLoad, measurements: [{ ...series, muzzleDistance: 3 }] },
      'measurements',
    )
    expectIssueAt(
      load,
      { ...userLoad, measurements: [{ ...series, strings: [{ shots: [{}] }] }] },
      'measurements',
    )
  })
})

describe('checkUserRefs of a load', () => {
  const records = (data: Partial<Load>) =>
    [
      wrap({ ...userLoad, ...data }),
      { ...wrap({ origin: 'user' }, 'firearm'), id: uuid },
    ] as unknown as Parameters<typeof checkUserRefs>[0]

  it('reports a user reference no record answers, and none for a catalogue reference or a firearm that exists', () => {
    const missing = checkUserRefs(records({ cartridge: `user:${other}` }))
    expect(missing.map((d) => d.field)).toEqual(['cartridge', 'bullet'])
    expect(checkUserRefs(records({ bullet: 'catalogue:example-a-1' }))).toEqual([])
  })
})
