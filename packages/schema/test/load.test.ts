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
  capacity: 'catalogue:example-capacity',
  case: { firingCount: 2 },
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
      expect(parsed.records[0]?.data).toEqual(load.parse(data))
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

  it('keeps the typed bullet values under overrides', () => {
    const typed = {
      ...userLoad,
      analysis: {
        overrides: {
          bulletDiameter: 7.82,
          bulletLength: 31.5,
          bulletBcG1: 0.462,
          bulletBcG7: 0.23,
        },
      },
    }
    expect(load.parse(typed)).toEqual(typed)
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

  it('lets a user load name a user powder and refuses a plain id', () => {
    expect(load.safeParse({ ...userLoad, powder: `user:${uuid}` }).success).toBe(true)
    expect(load.safeParse({ ...userLoad, powder: 'example-a-fast' }).success).toBe(false)
  })

  it('names records only: a user record is no catalogue record, a description is measured data', () => {
    expectIssueAt(load, { ...catalogueLoad, bullet: `user:${uuid}` }, 'bullet')
    expectIssueAt(load, { ...catalogueLoad, powder: `user:${uuid}` }, 'powder')
    const description = {
      bullet: { manufacturer: 'catalogue:maker', model: 'FMJ', bulletMass: { value: 10 } },
      powder: { manufacturer: 'catalogue:maker', name: 'Fast' },
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

  it('names a component maker by a reference, a catalogue load by a catalogue one', () => {
    expectIssueAt(
      load,
      { ...catalogueLoad, case: { manufacturer: `user:${uuid}` } },
      'case.manufacturer',
    )
    const measured = { provenance: { kind: 'measured', sources: [{ title: 'Own measurement' }] } }
    const legacy = { manufacturer: 'catalogue:maker', manufacturerName: 'Maker' }
    expectIssueAt(
      load,
      {
        ...catalogueLoad,
        ...measured,
        bullet: { ...legacy, model: 'FMJ', bulletMass: { value: 10 } },
      },
      'bullet',
    )
    expectIssueAt(
      load,
      { ...catalogueLoad, ...measured, powder: { ...legacy, name: 'Fast' } },
      'powder',
    )
  })

  it('names the primer by a catalogue record and refuses the older maker and model text', () => {
    const primer = (p: unknown) => ({ ...userLoad, primer: p })
    expect(issuePaths(load, primer({ record: 'catalogue:example-primer', lot: 'R-2' }))).toEqual([])
    expect(issuePaths(load, primer({ lot: 'R-2' }))).toEqual([])
    expectIssueAt(load, primer({ record: `user:${uuid}` }), 'primer.record')
    expectIssueAt(load, primer({ record: 'example-primer' }), 'primer.record')
    expectIssueAt(load, primer({ manufacturer: 'catalogue:maker', model: 'LR' }), 'primer')
  })

  it('keeps lots and one snapshot per session of the load, and a firearm round count to note', () => {
    const session = `user:${other}`
    const snapshot = {
      session,
      powderLot: 'P-1',
      primerLot: 'R-2',
      caseLot: 'C-3',
      seating: { by: 'baseToOgive', value: { value: 54.1 } },
      roundCount: 120,
      dismissed: ['seating'],
    }
    const withLots = {
      ...userLoad,
      powderLot: 'P-1',
      primer: { lot: 'R-2' },
      case: { lot: 'C-3' },
      sessions: [session],
      snapshots: [snapshot],
    }
    expect(load.parse(withLots)).toEqual(withLots)
    expectIssueAt(
      load,
      { ...withLots, snapshots: [{ ...snapshot, session: `user:${uuid}` }] },
      'snapshots',
    )
    expectIssueAt(load, { ...withLots, snapshots: [snapshot, snapshot] }, 'snapshots')
    expectIssueAt(load, { ...withLots, snapshots: [{ ...snapshot, roundCount: -1 }] }, 'snapshots')
    expectIssueAt(load, { ...withLots, snapshots: [{ ...snapshot, bullet: 'x' }] }, 'snapshots')
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
      { case: { firingCount: -1 } },
      { capacity: 'example-capacity' },
      { capacity: 'user:1' },
      { seating: { by: 'overallLength', value: { value: 0 } } },
      { seating: { by: 'depth', value: { value: 70 } } },
      { cartridge: '308-win' },
      { firearm: 'f5' },
    ])
      expect(issuePaths(load, { ...userLoad, ...data })).not.toEqual([])
  })

  it('refuses the water capacity of the earlier format, now a reference to a capacity', () => {
    expectIssueAt(load, { ...userLoad, case: { waterCapacity: { value: 3.52 } } }, 'case')
    const record = { ...wrap({ ...userLoad, case: { waterCapacity: { value: 3.52 } } }) }
    expect(userRecord.safeParse(record).success).toBe(false)
  })

  it('names the capacity of a catalogue load by a catalogue reference', () => {
    expect(
      load.safeParse({ ...catalogueLoad, capacity: 'catalogue:example-capacity' }).success,
    ).toBe(true)
    expectIssueAt(load, { ...catalogueLoad, capacity: `user:${uuid}` }, 'capacity')
  })

  it('names a case record by a reference: a user load may name a case group of the user', () => {
    const record = 'catalogue:example-308-win-brass'
    expect(load.parse({ ...userLoad, case: { firingCount: 2, record } }).case?.record).toBe(record)
    expect(issuePaths(load, { ...catalogueLoad, case: { record } })).toEqual([])
    expect(load.safeParse({ ...userLoad, case: { record: `user:${uuid}` } }).success).toBe(true)
    expectIssueAt(load, { ...catalogueLoad, case: { record: `user:${uuid}` } }, 'case.record')
    expectIssueAt(load, { ...userLoad, case: { record: 'example-308-win-brass' } }, 'case.record')
  })

  it('names its sessions by reference', () => {
    const sessions = [`user:${uuid}`, 'catalogue:example-session']
    expect(load.parse({ ...userLoad, sessions })).toEqual({ ...userLoad, sessions })
    expectIssueAt(load, { ...userLoad, sessions: ['example-session'] }, 'sessions.0')
    expectIssueAt(load, { ...catalogueLoad, sessions }, 'sessions.0')
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

  it('reports a user capacity no record answers', () => {
    const capacityId = crypto.randomUUID()
    const capacity = {
      ...wrap(
        { origin: 'user', cartridge: 'catalogue:308-win', waterCapacity: { value: 3.5 } },
        'caseCapacity',
      ),
      id: capacityId,
    }
    const own = (id: string) =>
      [wrap({ ...userLoad, capacity: `user:${id}` }), capacity] as unknown as Parameters<
        typeof checkUserRefs
      >[0]
    const missing = (id: string) => checkUserRefs(own(id)).filter((d) => d.field === 'capacity')
    expect(missing(capacityId)).toEqual([])
    expect(missing(crypto.randomUUID())).toHaveLength(1)
  })
})
