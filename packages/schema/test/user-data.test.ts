import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  checkUserRefs,
  designIdProblem,
  firearm,
  legacyLoadProblem,
  type UserRecord,
  units,
  userDataFile,
  userDataFormat,
  userDataVersion,
  userRecord,
  userRefFields,
  versionProblem,
  withoutUnknownKinds,
} from '../src/index.ts'

const saved = '2026-10-13T10:00:00.000Z'
const uuid = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const other = '7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57'
const designUuid = '9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const bulletRecord = {
  kind: 'bullet',
  id: designUuid,
  name: 'Manufacturer 168 gr',
  saved,
  data: {
    origin: 'user',
    manufacturer: 'catalogue:test-maker',
    basedOn: 'catalogue:alpha-30425',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.886 },
      base: { type: 'boat-tail', angle: null },
    },
  },
} as const
const manufacturerRecord = {
  kind: 'manufacturer',
  id: uuid,
  name: 'Home Loader',
  saved,
  data: { origin: 'user' },
} as const
const cartridgeRecord = {
  kind: 'cartridge',
  id: other,
  name: 'Design',
  saved,
  data: {
    origin: 'user',
    overrides: {
      table: 'I',
      values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51.18 }],
    },
  },
} as const
const loadRecord = {
  kind: 'load',
  id: 'w4',
  name: 'Load',
  saved,
  data: { origin: 'user', charge: { value: 2.8 }, cartridge: 'catalogue:308-win' },
} as const

const firearmRecord = {
  kind: 'firearm',
  id: 'f5',
  name: 'Range rifle',
  saved,
  data: {
    origin: 'user',
    name: 'Range rifle',
    manufacturer: 'catalogue:test-maker',
    cartridge: 'catalogue:308-win',
    barrelLength: { value: 610 },
    twist: { value: 254 },
    twistHand: 'right',
    roundCount: 1200,
    optics: [
      {
        id: 'o1',
        kind: 'scope',
        name: '5-25x56',
        clickUnit: 'mrad',
        clickValue: { value: 0.00573 },
      },
      { id: 'o2', kind: 'redDot', name: 'Offset dot' },
    ],
    configurations: [
      {
        id: 'c1',
        name: 'Scope and dot',
        mounts: [
          { optic: 'o1', sightHeight: { value: 55 }, zeroRange: { value: 100000 } },
          {
            optic: 'o2',
            sightHeight: { value: 40 },
            lateralOffset: { value: 30 },
            cant: { value: 45 },
            zeroRange: { value: 50000 },
          },
        ],
        mounted: '2026-04-01',
      },
    ],
    active: 'c1',
  },
} as const

const caseUuid = '5d6e7f80-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const caseRecord = {
  kind: 'case',
  id: caseUuid,
  name: 'Match brass, lot 3',
  saved,
  data: {
    origin: 'user',
    name: 'Match brass, lot 3',
    cartridge: 'catalogue:308-win',
    material: 'brass',
    numberOfFirings: 3,
    trimLength: { value: 51.1 },
  },
} as const

const sheetRecord = {
  kind: 'targetSheet',
  id: 't1',
  name: 'Ladder sheet',
  saved: '2026-10-15T10:00:00.000Z',
  data: {
    references: [],
    targetRotation: 0,
    load: 'w1',
    groups: [
      {
        id: 'g1',
        name: 'Step 1',
        colour: '#d9480f',
        distance: 100,
        ladderStep: 0,
        shots: [{ x: 0.003, y: -0.001, placement: 'placed' }],
      },
    ],
  },
} as const

const faceRecord = {
  kind: 'targetFaceDesign',
  id: 'f1',
  name: 'Club face',
  saved,
  data: {
    rings: [
      { value: 1, diameter: 100, fill: 'white', line: 'black' },
      { value: 2, diameter: 50 },
    ],
    innerTen: { diameter: 10, rule: 'cover' },
    blackDiameter: 50,
    decimal: true,
    events: [{ name: '25 m', distance: 25000, gauge: 5.6 }],
  },
} as const

const powderId = '5d4c3b2a-1f0e-4d9c-8b7a-6a5f4e3d2c1b'
const powderRecord = {
  kind: 'powder',
  id: powderId,
  name: 'Draft powder',
  saved,
  data: {
    origin: 'user',
    provenanceKind: 'fitted',
    draft: {
      grainForm: 'extruded',
      propellantBase: 'double',
      bulkDensity: { value: 0.9 },
      composition: [{ name: 'Nitrocellulose', min: 60, max: 100 }, {}],
      interior: { fitted: ['vivacity'], gamma: 1.24, burnForm: { a: { value: 0.5 } } },
    },
  },
} as const

const powderFit = {
  input: [
    {
      charge: { value: 2.8 },
      muzzleVelocity: { value: 820 },
      shots: 5,
      barrelLength: { value: 610 },
      temperature: { value: 21 },
      caseCapacity: { value: 3.6 },
      bulletMass: { value: 10.886 },
    },
  ],
  parameters: ['burnRate', 'startPressure'],
  options: {
    prior: { burnRate: { value: 1.2, sigma: 0.3 } },
    loss: { kind: 'huber', threshold: 2 },
  },
  date: saved,
  model: 'm3',
  modelVersion: '0.0.4',
  confidence: 'moderate',
  reasons: ['no-pressure', 'narrow-ladder'],
  sessions: [`user:${uuid}`],
  previous: `user:${other}`,
} as const
const fittedPowder = { ...powderRecord, data: { ...powderRecord.data, fit: powderFit } } as const

const file = (records: unknown[], version: unknown = userDataVersion) => ({
  format: userDataFormat,
  version,
  records,
})

describe('userDataFile', () => {
  it('accepts every record kind', () => {
    expect(
      userDataFile.safeParse(
        file([
          manufacturerRecord,
          bulletRecord,
          cartridgeRecord,
          loadRecord,
          firearmRecord,
          sheetRecord,
          faceRecord,
          powderRecord,
          caseRecord,
        ]),
      ).success,
    ).toBe(true)
  })

  it('keeps the import a record came from and checks its bounds', () => {
    const imported = { source: 'Maker load data 2026', file: 'loads.csv', day: '2026-10-20' }
    const withImport = { ...loadRecord, imported }
    expect(userDataFile.parse(JSON.parse(JSON.stringify(file([withImport])))).records).toEqual([
      withImport,
    ])
    expect(userRecord.safeParse(loadRecord).success).toBe(true)
    const bad = (i: object) =>
      userRecord.safeParse({ ...loadRecord, imported: { ...imported, ...i } }).success
    expect(bad({ source: '' })).toBe(false)
    expect(bad({ source: 'x'.repeat(500) })).toBe(true)
    expect(bad({ source: 'x'.repeat(501) })).toBe(false)
    expect(bad({ file: 'x'.repeat(200) })).toBe(true)
    expect(bad({ file: 'x'.repeat(201) })).toBe(false)
    expect(bad({ day: '2026-10-20T10:00:00Z' })).toBe(false)
    expect(bad({ day: '20.10.2026' })).toBe(false)
  })

  it('keeps a case group and its measured fields through a round trip', () => {
    const json = JSON.parse(JSON.stringify(file([caseRecord])))
    expect(userDataFile.parse(json).records).toEqual([caseRecord])
    expect(
      userRecord.safeParse({ ...caseRecord, data: { ...caseRecord.data, material: 1 } }).success,
    ).toBe(false)
  })

  it('takes a powder draft with missing values and keeps it through a round trip', () => {
    expect(userRecord.parse(powderRecord)).toEqual(powderRecord)
    const empty = { ...powderRecord, data: { origin: 'user' } }
    expect(userRecord.parse(empty)).toEqual(empty)
  })

  it('rejects a powder draft with a value of the wrong type or an unknown kind', () => {
    const draft = (d: object) => ({ ...powderRecord, data: { ...powderRecord.data, draft: d } })
    expect(userRecord.safeParse(draft({ grainForm: 'cube' })).error?.issues[0]?.path).toEqual([
      'data',
      'draft',
      'grainForm',
    ])
    expect(userRecord.safeParse(draft({ bulkDensity: { value: 'dense' } })).success).toBe(false)
    const kind = { ...powderRecord, data: { ...powderRecord.data, provenanceKind: 'guessed' } }
    expect(userRecord.safeParse(kind).success).toBe(false)
  })

  it('keeps a powder draft whose numbers are out of the finished record bounds', () => {
    const interior = { gamma: 1, pressureExponent: 0, burnForm: { z1: 0 } }
    const draft = { ...powderRecord, data: { ...powderRecord.data, draft: { interior } } }
    expect(userRecord.safeParse(draft).success).toBe(true)
  })

  it('keeps the fit of a fitted powder through a round trip, without resolving its references', () => {
    const json = JSON.parse(JSON.stringify(file([fittedPowder])))
    const { records } = userDataFile.parse(json)
    expect(records).toEqual([fittedPowder])
    expect(checkUserRefs(records)).toEqual([])
    expect(userRefFields(fittedPowder)).toEqual([])
  })

  it('rejects a fit with more than 40 points, a negative charge or a missing field', () => {
    const [point] = powderFit.input
    const ok = (fit: object) =>
      userRecord.safeParse({ ...fittedPowder, data: { ...fittedPowder.data, fit } }).success
    expect(ok({ ...powderFit, input: Array(40).fill(point) })).toBe(true)
    expect(ok({ ...powderFit, input: Array(41).fill(point) })).toBe(false)
    expect(ok({ ...powderFit, input: [{ ...point, charge: { value: -2.8 } }] })).toBe(false)
    const { caseCapacity: _, ...noCapacity } = point
    expect(ok({ ...powderFit, input: [noCapacity] })).toBe(false)
    expect(ok({ ...powderFit, input: [{ ...point, charge: 2.8 }] })).toBe(false)
    expect(ok({ ...powderFit, sessions: ['catalogue:range-day'] })).toBe(false)
    expect(ok({ ...powderFit, previous: 'old-1' })).toBe(false)
    expect(ok({ ...powderFit, parameters: ['burnRate', 'burnRate'] })).toBe(false)
  })

  it('refuses a powder with an id that is no UUID, and says why', () => {
    const r = userRecord.safeParse({ ...powderRecord, id: 'old-1' })
    expect(r.error?.issues[0]).toMatchObject({ path: ['id'], message: designIdProblem })
  })

  it('takes a user manufacturer as a name and refuses another origin', () => {
    expect(userRecord.parse(manufacturerRecord)).toEqual(manufacturerRecord)
    const shared = { ...manufacturerRecord, data: { origin: 'shared' } }
    expect(userRecord.safeParse(shared).error?.issues[0]?.path).toEqual(['data', 'origin'])
  })

  it('refuses the manufacturer name of an older bullet or firearm', () => {
    const named = (r: { data: object }) => ({
      ...r,
      data: { ...r.data, manufacturerName: 'Maker' },
    })
    for (const r of [bulletRecord, firearmRecord])
      expect(userRecord.safeParse(named(r)).success).toBe(false)
  })

  it('takes a manufacturer reference of either scope and refuses a plain text', () => {
    const maker = (manufacturer: string) =>
      userRecord.safeParse({ ...firearmRecord, data: { ...firearmRecord.data, manufacturer } })
        .success
    expect(maker('catalogue:alpha-powder')).toBe(true)
    expect(maker(`user:${uuid}`)).toBe(true)
    expect(maker('Alpha Powder')).toBe(false)
  })

  it('takes a face draft with missing values and rejects a non-positive size', () => {
    const draft = { ...faceRecord, data: { rings: [{}], events: [{ name: '' }] } }
    expect(userRecord.safeParse(draft).success).toBe(true)
    const zero = { ...faceRecord, data: { ...faceRecord.data, blackDiameter: 0 } }
    expect(userRecord.safeParse(zero).error?.issues[0]?.path).toEqual(['data', 'blackDiameter'])
  })

  it('takes a catalogue reference as the base of a variant and refuses another text', () => {
    const basedOn = (text: string) =>
      userRecord.safeParse({ ...bulletRecord, data: { ...bulletRecord.data, basedOn: text } })
        .success
    expect(basedOn('catalogue:alpha-30425')).toBe(true)
    for (const bad of ['alpha-30425', 'Alpha 30425', `user:${uuid}`, 'catalogue:Alpha 30425'])
      expect(basedOn(bad)).toBe(false)
  })

  it('keeps the revision the base had at save, for a bullet and a cartridge', () => {
    const bullet = {
      ...bulletRecord,
      data: { ...bulletRecord.data, basedOnRevision: '0a1b2c3d4e5f60' },
    }
    const cartridge = {
      ...cartridgeRecord,
      data: { origin: 'user', basedOn: 'catalogue:308-win', basedOnRevision: '0a1b2c3d4e5f60' },
    }
    expect(userDataFile.parse(file([bullet, cartridge])).records).toEqual([bullet, cartridge])
    const empty = { ...bullet, data: { ...bullet.data, basedOnRevision: '' } }
    expect(userRecord.safeParse(empty).success).toBe(false)
  })

  it('saves a variant of a bullet without a base, a mass or a manufacturer', () => {
    const alone = {
      ...bulletRecord,
      data: { origin: 'user', overrides: { diameter: { value: 7.82 } } },
    }
    expect(userRecord.parse(alone)).toEqual(alone)
    const bare = { ...cartridgeRecord, data: { origin: 'user' } }
    expect(userRecord.parse(bare)).toEqual(bare)
  })

  it('refuses a bullet or cartridge with an id that is no UUID, and says why', () => {
    for (const r of [bulletRecord, cartridgeRecord]) {
      const old = userRecord.safeParse({ ...r, id: 'lk3j2h1g-a8s7d6f5' })
      expect(old.success).toBe(false)
      expect(old.error?.issues[0]).toMatchObject({ path: ['id'], message: designIdProblem })
      expect(userDataFile.safeParse(file([r, { ...r, id: 'old-1' }])).success).toBe(false)
    }
  })

  it('opens records with an old browser id and with a UUID', () => {
    const ids = ['lk3j2h1g-a8s7d6f5', uuid]
    expect(userDataFile.safeParse(file(ids.map((id) => ({ ...loadRecord, id })))).success).toBe(
      true,
    )
  })

  it('keeps the overrides through a round trip, including a null and a removed value', () => {
    const removed = {
      ...cartridgeRecord,
      data: {
        origin: 'user',
        basedOn: 'catalogue:308-win',
        overrides: {
          table: null,
          values: [{ side: 'chamber', symbol: 'L3', quantity: 'length', value: null }],
        },
      },
    }
    expect(userDataFile.parse(file([bulletRecord, removed])).records).toEqual([
      bulletRecord,
      removed,
    ])
  })

  it('refuses the design kinds of the older format', () => {
    for (const kind of ['bulletDesign', 'cartridgeDesign'])
      expect(userRecord.safeParse({ ...bulletRecord, kind }).error?.issues[0]?.path).toEqual([
        'kind',
      ])
  })

  it('rejects two records with one id', () => {
    const twin = { ...loadRecord, name: 'Another load' }
    expect(userDataFile.safeParse(file([loadRecord, twin])).error?.issues[0]?.path).toEqual([
      'records',
    ])
  })

  it('rejects another format and a newer version', () => {
    expect(userDataFile.safeParse({ ...file([]), format: 'other' }).success).toBe(false)
    expect(userDataFile.safeParse(file([], 5)).error?.issues[0]?.path).toEqual(['version'])
  })

  it('rejects an unknown kind, a bad date, a non-finite value and an invalid spec value', () => {
    const paths = (r: object) => userRecord.safeParse(r).error?.issues.map((i) => i.path.join('.'))
    expect(paths({ ...bulletRecord, kind: 'unknown' })).toEqual(['kind'])
    expect(paths({ ...bulletRecord, saved: 'yesterday' })).toEqual(['saved'])
    expect(
      paths({
        ...bulletRecord,
        data: { ...bulletRecord.data, overrides: { mass: { value: 'x' } } },
      }),
    ).toEqual(['data.overrides.mass.value'])
    expect(
      paths({
        ...cartridgeRecord,
        data: {
          origin: 'user',
          overrides: { values: [{ symbol: 'L3', quantity: 'length' }] },
        },
      }),
    ).toEqual(['data.overrides.values.0'])
  })

  it('caps text lengths', () => {
    expect(userRecord.safeParse({ ...loadRecord, name: 'x'.repeat(201) }).success).toBe(false)
    expect(userRecord.safeParse({ ...loadRecord, id: '' }).success).toBe(false)
  })
})

describe('userDataFile files', () => {
  const file = (files: unknown) => ({
    format: userDataFormat,
    version: userDataVersion,
    records: [bulletRecord],
    files,
  })

  it('carries photos as base64 and reads a file without them', () => {
    const files = [{ id: 'p1', type: 'image/png', data: 'iVBORw0KGgo=' }]
    expect(userDataFile.parse(file(files)).files).toEqual(files)
    expect(userDataFile.parse(file(undefined)).files).toBeUndefined()
  })

  it('takes images only, as base64, with unique ids', () => {
    const png = { id: 'p1', type: 'image/png', data: 'iVBORw0KGgo=' }
    for (const bad of [
      [{ ...png, type: 'text/html' }],
      // a script-capable image is refused: photos are raster files only
      [{ ...png, type: 'image/svg+xml' }],
      [{ ...png, data: 'not base64!' }],
      [png, png],
      [{ ...png, id: '' }],
    ])
      expect(userDataFile.safeParse(file(bad)).success).toBe(false)
    for (const type of ['jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'bmp'])
      expect(userDataFile.safeParse(file([{ ...png, type: `image/${type}` }])).success).toBe(true)
  })
})

describe('a record of the earlier load format', () => {
  const old = {
    kind: 'workbenchState',
    id: 'w1',
    name: 'Load',
    saved,
    data: { siValues: { charge: 0.0028 }, cartridge: '308-win' },
  }

  it('is refused with a message that names the new kind', () => {
    const r = userRecord.safeParse(old)
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).toBe(legacyLoadProblem)
    expect(legacyLoadProblem).toContain('"load"')
    const f = userDataFile.safeParse(file([old]))
    expect(f.success).toBe(false)
    expect(JSON.stringify(f.error?.issues)).toContain('earlier version')
  })

  it('does not hide the usual message for another unknown kind', () => {
    const r = userRecord.safeParse({ ...old, kind: 'other' })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]?.message).not.toBe(legacyLoadProblem)
  })
})

describe('withoutUnknownKinds', () => {
  const event = { kind: 'event', id: 'e1', name: 'Club match', saved, data: {} }

  it('leaves out the records of an unknown kind and counts them by kind', () => {
    const json = file([event, loadRecord, { ...event, id: 'e2' }])
    const { json: known, skipped } = withoutUnknownKinds(json)
    expect(userDataFile.parse(known).records).toEqual([loadRecord])
    expect(skipped).toEqual([{ kind: 'event', count: 2 }])
    expect(json.records).toHaveLength(3)
  })

  it('keeps known kinds, the old load kind and records without a text kind for the schema', () => {
    const json = file([
      loadRecord,
      { ...event, kind: 'workbenchState' },
      { ...event, kind: 2 },
      null,
    ])
    expect(withoutUnknownKinds(json)).toEqual({ json, skipped: [] })
    expect(withoutUnknownKinds('text')).toEqual({ json: 'text', skipped: [] })
  })
})

describe('firearm', () => {
  const paths = (data: object) =>
    userRecord
      .safeParse({ ...firearmRecord, data: { ...firearmRecord.data, ...data } })
      .error?.issues.map((i) => i.path.join('.'))
  const [scope, dot] = firearmRecord.data.optics
  const config = firearmRecord.data.configurations[0]

  it('rejects a mount of an optic the firearm does not list', () => {
    expect(
      paths({ configurations: [{ ...config, mounts: [{ ...config.mounts[0], optic: 'o9' }] }] }),
    ).toEqual(['data.configurations.0.mounts.0.optic'])
  })

  it('rejects an unknown active configuration and duplicate ids', () => {
    expect(paths({ active: 'c9' })).toEqual(['data.active'])
    expect(paths({ optics: [scope, { ...dot, id: 'o1' }] })).toContain('data.optics.1.id')
  })

  it('needs a mount per configuration, finite numbers and a known twist direction', () => {
    expect(paths({ configurations: [{ ...config, mounts: [] }] })).toEqual([
      'data.configurations.0.mounts',
    ])
    expect(paths({ twist: { value: Number.POSITIVE_INFINITY } })).toEqual(['data.twist.value'])
    expect(paths({ twistHand: 'up' })).toEqual(['data.twistHand'])
    expect(paths({ roundCount: 1.5 })).toEqual(['data.roundCount'])
    expect(paths({ roundCountDate: '2026-10-12T08:00:00Z' })).toEqual(['data.roundCountDate'])
  })

  it('caps texts and lists', () => {
    expect(paths({ notes: 'x'.repeat(10001) })).toEqual(['data.notes'])
    expect(
      paths({ optics: Array.from({ length: 21 }, (_, i) => ({ ...dot, id: `o${i}` })) }),
    ).toContain('data.optics')
    const counted = { session: 'user:00000000-0000-4000-8000-000000000001', rounds: 3 }
    expect(paths({ countedSessions: [counted] })).toBeUndefined()
    expect(paths({ countedSessions: Array(201).fill(counted) })).toEqual(['data.countedSessions'])
    expect(paths({ countedSessions: [{ ...counted, rounds: -1 }] })).toEqual([
      'data.countedSessions.0.rounds',
    ])
    expect(paths({ countedSessions: [{ ...counted, shots: 3 }] })).toEqual([
      'data.countedSessions.0',
    ])
  })

  it('checks the magnification range and the configuration dates', () => {
    expect(
      paths({ optics: [{ ...scope, minMagnification: 25, maxMagnification: 5 }, dot] }),
    ).toEqual(['data.optics.0.maxMagnification'])
    expect(
      paths({ optics: [{ ...scope, minMagnification: 5, maxMagnification: 5 }, dot] }),
    ).toBeUndefined()
    const dated = (mounted: string, removed: string) => ({
      configurations: [{ ...config, mounted, removed }],
    })
    expect(paths(dated('2026-05-01', '2026-04-30'))).toEqual(['data.configurations.0.removed'])
    expect(paths(dated('2026-05-01', '2026-05-01'))).toBeUndefined()
    // also while another field of the configuration is not valid
    const unzeroed = { ...config.mounts[0], zeroRange: { value: 0 } }
    expect(
      paths({
        configurations: [
          { ...config, mounts: [unzeroed], mounted: '2026-05-01', removed: '2026-04-30' },
        ],
      }),
    ).toEqual(['data.configurations.0.mounts.0.zeroRange.value', 'data.configurations.0.removed'])
  })

  it('rejects a null optic or configuration without running their checks on it', () => {
    expect(paths({ optics: [null, dot], configurations: [null] })).toEqual([
      'data.optics.0',
      'data.configurations.0',
    ])
  })

  describe('zero air and drag factor of a mount', () => {
    const mountWith = (m: object) => ({
      configurations: [{ ...config, mounts: [{ ...config.mounts[0], ...m }] }],
    })
    const zero = {
      zeroTemperature: { value: 15 },
      zeroPressure: { value: 1013.25 },
      zeroHumidity: { value: 50 },
      dragFactor: 1.034,
      dragFactorSource: 'Truing session of 2026-09-14',
    }

    it('round-trips through a user data file', () => {
      const record = { ...firearmRecord, data: { ...firearmRecord.data, ...mountWith(zero) } }
      const parsed = userDataFile.parse(file([record]))
      expect(parsed.records[0]).toEqual(record)
      expect(JSON.parse(JSON.stringify(parsed))).toEqual(parsed)
    })

    it('rejects a non-positive factor, a humidity outside 0 to 100 and an air below its floor', () => {
      const at = (key: string, leaf = '.value') => `data.configurations.0.mounts.0.${key}${leaf}`
      for (const [key, bad] of [
        ['zeroHumidity', -0.01],
        ['zeroHumidity', 100.01],
        ['zeroTemperature', -273.15],
        ['zeroPressure', -1],
      ] as const)
        expect(paths(mountWith({ [key]: { value: bad } }))).toEqual([at(key)])
      for (const bad of [0, -1])
        expect(paths(mountWith({ dragFactor: bad }))).toEqual([at('dragFactor', '')])
      expect(paths(mountWith({ zeroHumidity: { value: 0 } }))).toBeUndefined()
      expect(paths(mountWith({ zeroHumidity: { value: 100 } }))).toBeUndefined()
      // below 0 degC is a valid zero
      expect(paths(mountWith({ zeroTemperature: { value: -20 } }))).toBeUndefined()
    })
  })

  describe('truing results of a configuration', () => {
    const result = {
      date: '2026-10-29',
      bullet: 'Test bullet',
      muzzleVelocity: { value: 790 },
      zeroRange: { value: 100000 },
      temperature: { value: 15 },
      pressure: { value: 1013.25 },
      humidity: { value: 0 },
      clickValue: { value: 0.00573 },
      fitZeroOffset: false,
      rows: [
        {
          kind: 'impact',
          range: { value: 300000 },
          shots: 5,
          mean: { value: -120 },
          deviation: { value: 60 },
        },
        { kind: 'dial', range: { value: 800000 }, shots: 5, mean: 64, deviation: 2 },
      ],
      chronograph: { shots: 10, mean: { value: 800 }, deviation: { value: 4 } },
      parameters: [
        {
          name: 'muzzleVelocity',
          status: 'identified',
          reasons: [],
          value: { value: 801 },
          lower: { value: 796 },
          upper: { value: 806 },
          confidenceLevel: 0.95,
        },
        { name: 'dragFactor', status: 'weak', reasons: ['imprecise'] },
      ],
      intervalsTrusted: true,
    }
    const withResults = (truing: unknown[]) => ({ configurations: [{ ...config, truing }] })

    it('round-trips through a user data file', () => {
      const record = { ...firearmRecord, data: { ...firearmRecord.data, ...withResults([result]) } }
      expect(userDataFile.parse(file([record])).records[0]).toEqual(record)
    })

    it('rejects a dial in lengths, an impact in clicks and an unknown parameter', () => {
      const [impact, dial] = result.rows
      expect(paths(withResults([{ ...result, rows: [{ ...dial, mean: { value: 64 } }] }]))).toEqual(
        ['data.configurations.0.truing.0.rows.0.mean'],
      )
      expect(paths(withResults([{ ...result, rows: [{ ...impact, mean: -120 }] }]))).toEqual([
        'data.configurations.0.truing.0.rows.0.mean',
      ])
      expect(
        paths(
          withResults([
            { ...result, parameters: [{ name: 'twist', status: 'weak', reasons: [] }] },
          ]),
        ),
      ).toEqual(['data.configurations.0.truing.0.parameters.0.name'])
    })
  })

  it('takes a lands contact with the bullet it was measured with, and none without that bullet', () => {
    const contact = { baseToOgiveAtLands: { value: 28.4 }, overallLengthAtLands: { value: 71.2 } }
    expect(paths({ ...contact, landsBullet: 'catalogue:test-bullet' })).toBeUndefined()
    expect(paths({ ...contact, landsBullet: `user:${uuid}` })).toBeUndefined()
    expect(paths({ baseToOgiveAtLands: { value: 28.4 } })).toEqual(['data.landsBullet'])
    expect(paths({ overallLengthAtLands: { value: 71.2 } })).toEqual(['data.landsBullet'])
    expect(paths({ landsBullet: 'Bullet' })).toEqual(['data.landsBullet'])
    // a firearm without a contact needs no bullet
    expect(paths({})).toBeUndefined()
  })

  it('round trips a lands contact through a user data file', () => {
    const data = {
      ...firearmRecord.data,
      baseToOgiveAtLands: { value: 28.4 },
      landsBullet: 'catalogue:test-bullet',
    }
    const parsed = userDataFile.parse({ ...file([{ ...firearmRecord, data }]) })
    expect(parsed.records[0]?.data).toMatchObject({
      baseToOgiveAtLands: { value: 28.4 },
      landsBullet: 'catalogue:test-bullet',
    })
  })

  it('keeps a firearm without optics', () => {
    expect(paths({ optics: [], configurations: [], active: undefined })).toBeUndefined()
  })

  it('refuses the old SI shape: plain numbers in m and no origin', () => {
    const { origin: _, ...rest } = firearmRecord.data
    expect(paths({ barrelLength: 0.61 })).toEqual(['data.barrelLength'])
    expect(paths({ cartridge: '308-win' })).toEqual(['data.cartridge'])
    expect(userRecord.safeParse({ ...firearmRecord, data: rest }).success).toBe(false)
  })

  it('takes a maker reference of either scope, and one schema for every origin', () => {
    expect(paths({ manufacturer: 'user:2f6c1f3e-9b5a-4a8e-8f21-3c1d7a5b9e10' })).toBeUndefined()
    expect(paths({ manufacturer: 'Maker' })).toEqual(['data.manufacturer'])
    for (const origin of ['catalogue', 'user', 'shared'])
      expect(firearm.safeParse({ ...firearmRecord.data, origin }).success).toBe(true)
    expect(paths({ origin: 'cloud' })).toEqual(['data.origin'])
  })

  it('stores every quantity in the one unit of its kind', () => {
    const props = z.toJSONSchema(firearm).properties as Record<string, { unit?: string }>
    expect(
      Object.fromEntries(
        ['barrelLength', 'twist', 'grooveDiameter', 'firearmMass'].map((k) => [k, props[k]?.unit]),
      ),
    ).toEqual({
      barrelLength: units.length,
      twist: units.length,
      grooveDiameter: units.length,
      firearmMass: units.mass,
    })
  })
})

describe('versionProblem', () => {
  it('refuses another version, naming the version it reads', () => {
    expect(versionProblem(file([bulletRecord], 4))).toBe(
      'The file has format version 4; this app reads version 1.',
    )
    expect(versionProblem(file([], 0))).toBe(
      'The file has format version 0; this app reads version 1.',
    )
    expect(versionProblem(file([], '1'))).toBe(
      'The file has format version "1"; this app reads version 1.',
    )
    expect(userDataFile.safeParse(file([bulletRecord], 4)).success).toBe(false)
  })

  it('leaves the current version and other formats to the schema', () => {
    for (const x of [file([firearmRecord]), { format: 'x', version: 1 }, null, 'text'])
      expect(versionProblem(x)).toBeUndefined()
  })
})

describe('userRefFields', () => {
  it('names the fields of a record that point at records of the user', () => {
    const load = userRecord.parse({
      ...loadRecord,
      data: {
        ...loadRecord.data,
        cartridge: `user:${uuid}`,
        bullet: `user:${other}`,
        firearm: 'catalogue:some-rifle',
      },
    })
    expect(userRefFields(load)).toEqual(['cartridge', 'bullet'])
    const bullet = userRecord.parse({
      ...bulletRecord,
      data: { ...bulletRecord.data, manufacturer: `user:${uuid}` },
    })
    expect(userRefFields(bullet)).toEqual(['manufacturer'])
  })

  it('names the user references of a case group and of a load that names one', () => {
    const group = userRecord.parse({
      ...caseRecord,
      data: { ...caseRecord.data, cartridge: `user:${other}`, capacity: `user:${designUuid}` },
    })
    expect(userRefFields(group)).toEqual(['cartridge', 'capacity'])
    const load = userRecord.parse({
      ...loadRecord,
      data: { ...loadRecord.data, case: { lot: 'A', record: `user:${caseUuid}` } },
    })
    expect(userRefFields(load)).toEqual(['case.record'])
  })

  it('names none for a record that refers to the catalogue alone', () => {
    expect(userRefFields(userRecord.parse(loadRecord))).toEqual([])
    expect(userRefFields(userRecord.parse(bulletRecord))).toEqual([])
    expect(userRefFields(userRecord.parse(manufacturerRecord))).toEqual([])
  })
})

describe('checkUserRefs', () => {
  const withFirearm = (firearm: string) =>
    userRecord.parse({ ...loadRecord, data: { ...loadRecord.data, firearm } })
  const firearm = userRecord.parse(firearmRecord)

  it('reports a load that points at a missing firearm', () => {
    expect(checkUserRefs([withFirearm(`user:${uuid}`)])).toEqual([
      { record: 'w4', kind: 'load', field: 'firearm', target: `user:${uuid}` },
    ])
  })

  it('reports a firearm reference that names a record of another kind', () => {
    const other = userRecord.parse({ ...bulletRecord, id: uuid })
    expect(checkUserRefs([withFirearm(`user:${uuid}`), other])).toHaveLength(1)
  })

  it('reports nothing for a firearm that is there', () => {
    const own = { ...firearm, id: uuid }
    expect(checkUserRefs([withFirearm(`user:${uuid}`), own])).toEqual([])
  })

  it('leaves a catalogue reference and a record without references alone', () => {
    expect(checkUserRefs([withFirearm('catalogue:some-rifle')])).toEqual([])
    expect(checkUserRefs([userRecord.parse(loadRecord), userRecord.parse(bulletRecord)])).toEqual(
      [],
    )
  })

  it('reports a bullet or firearm whose user manufacturer nobody answers', () => {
    const records = [userRecord.parse(bulletRecord), userRecord.parse(firearmRecord)].map((r) => ({
      ...r,
      data: { ...r.data, manufacturer: `user:${uuid}` },
    })) as UserRecord[]
    expect(checkUserRefs(records).map((d) => [d.kind, d.field, d.target])).toEqual([
      ['bullet', 'manufacturer', `user:${uuid}`],
      ['firearm', 'manufacturer', `user:${uuid}`],
    ])
    const answered = userRecord.parse(manufacturerRecord)
    expect(checkUserRefs([...records, answered])).toEqual([])
    // a catalogue manufacturer is the catalogue's to answer
    const own = { ...records[0], data: { ...records[0]?.data, manufacturer: 'catalogue:beta' } }
    expect(checkUserRefs([own as UserRecord])).toEqual([])
  })

  it('reports a firearm whose lands bullet is a user bullet nobody answers', () => {
    const lands = userRecord.parse({
      ...firearmRecord,
      data: { ...firearmRecord.data, landsBullet: `user:${uuid}` },
    })
    expect(checkUserRefs([lands]).map((d) => [d.kind, d.field, d.target])).toEqual([
      ['firearm', 'landsBullet', `user:${uuid}`],
    ])
    expect(checkUserRefs([{ ...userRecord.parse(bulletRecord), id: uuid }, lands])).toEqual([])
    const catalogue = { ...lands, data: { ...lands.data, landsBullet: 'catalogue:a' } }
    expect(checkUserRefs([catalogue as UserRecord])).toEqual([])
  })

  it('reports a load whose case names a user manufacturer nobody answers', () => {
    const base = userRecord.parse(loadRecord)
    const withMakers = {
      ...base,
      data: {
        ...base.data,
        case: { manufacturer: `user:${uuid}` },
      },
    } as UserRecord
    expect(checkUserRefs([withMakers]).map((d) => d.field)).toEqual(['case.manufacturer'])
    expect(userRefFields(withMakers)).toEqual(['case.manufacturer'])
    expect(checkUserRefs([withMakers, userRecord.parse(manufacturerRecord)])).toEqual([])
  })

  it('reports a load whose cartridge or bullet is a user reference nobody answers', () => {
    const withRefs = (cartridge: string, bullet: string) =>
      userRecord.parse({ ...loadRecord, data: { ...loadRecord.data, cartridge, bullet } })
    const own = [
      { ...userRecord.parse(cartridgeRecord), id: uuid },
      { ...userRecord.parse(bulletRecord), id: crypto.randomUUID() },
    ]
    expect(checkUserRefs([withRefs(`user:${uuid}`, `user:${own[1]?.id}`), ...own])).toEqual([])
    expect(checkUserRefs([withRefs(`user:${uuid}`, 'catalogue:alpha-30425')])).toEqual([
      { record: 'w4', kind: 'load', field: 'cartridge', target: `user:${uuid}` },
    ])
    // a design of the other kind under that id does not answer
    expect(
      checkUserRefs([withRefs('catalogue:308-win', `user:${uuid}`), own[0] as never]),
    ).toHaveLength(1)
  })

  it('reports a load whose powder is a user reference nobody answers', () => {
    const withPowder = (powder: string) =>
      userRecord.parse({ ...loadRecord, data: { ...loadRecord.data, powder } })
    const own = userRecord.parse(powderRecord)
    expect(checkUserRefs([withPowder(`user:${powderId}`), own])).toEqual([])
    expect(checkUserRefs([withPowder(`user:${powderId}`)])).toEqual([
      { record: 'w4', kind: 'load', field: 'powder', target: `user:${powderId}` },
    ])
    expect(checkUserRefs([withPowder('catalogue:test-powder')])).toEqual([])
    expect(userRefFields(withPowder(`user:${powderId}`))).toContain('powder')
  })

  it('opens a load that names its cartridge and bullet by reference and refuses a plain id', () => {
    const open = (cartridge: string, bullet: string) =>
      userRecord.safeParse({ ...loadRecord, data: { ...loadRecord.data, cartridge, bullet } })
        .success
    expect(open('catalogue:308-win', `user:${uuid}`)).toBe(true)
    expect(open('308-win', 'alpha-30425')).toBe(false)
    expect(open('catalogue:308-win', 'user:1')).toBe(false)
  })

  it('reports a capacity record whose user cartridge or manufacturer nobody answers', () => {
    const capacity = userRecord.parse({
      kind: 'caseCapacity',
      id: other,
      name: 'Measured',
      saved,
      data: {
        origin: 'user',
        cartridge: `user:${uuid}`,
        caseManufacturer: `user:${crypto.randomUUID()}`,
        waterCapacity: { value: 3.5 },
      },
    })
    expect(checkUserRefs([capacity]).map((d) => [d.kind, d.field])).toEqual([
      ['caseCapacity', 'cartridge'],
      ['caseCapacity', 'caseManufacturer'],
    ])
    expect(
      checkUserRefs([{ ...userRecord.parse(cartridgeRecord), id: uuid }, capacity]),
    ).toHaveLength(1)
  })

  it('reports a case group whose capacity record nobody answers, and a load whose case group is missing', () => {
    const group = userRecord.parse({
      ...caseRecord,
      data: { ...caseRecord.data, capacity: `user:${other}` },
    })
    expect(checkUserRefs([group]).map((d) => [d.kind, d.field])).toEqual([['case', 'capacity']])
    const load = userRecord.parse({
      ...loadRecord,
      data: { ...loadRecord.data, case: { lot: 'A', record: `user:${caseUuid}` } },
    })
    expect(checkUserRefs([load]).map((d) => d.field)).toEqual(['case.record'])
    expect(checkUserRefs([load, userRecord.parse(caseRecord)])).toEqual([])
  })

  it('reports a target sheet whose load is missing', () => {
    const sheet = userRecord.parse({ ...sheetRecord, data: { ...sheetRecord.data, load: 'gone' } })
    expect(checkUserRefs([sheet])).toEqual([
      { record: 't1', kind: 'targetSheet', field: 'load', target: 'gone' },
    ])
    expect(checkUserRefs([sheet, userRecord.parse({ ...loadRecord, id: 'gone' })])).toEqual([])
  })
})
