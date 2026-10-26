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
        ]),
      ).success,
    ).toBe(true)
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
  })

  it('caps texts and lists', () => {
    expect(paths({ notes: 'x'.repeat(10001) })).toEqual(['data.notes'])
    expect(
      paths({ optics: Array.from({ length: 21 }, (_, i) => ({ ...dot, id: `o${i}` })) }),
    ).toContain('data.optics')
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

  it('reports a load whose primer or case names a user manufacturer nobody answers', () => {
    const base = userRecord.parse(loadRecord)
    const withMakers = {
      ...base,
      data: {
        ...base.data,
        primer: { manufacturer: `user:${uuid}` },
        case: { manufacturer: `user:${uuid}` },
      },
    } as UserRecord
    expect(checkUserRefs([withMakers]).map((d) => d.field)).toEqual([
      'primer.manufacturer',
      'case.manufacturer',
    ])
    expect(userRefFields(withMakers)).toEqual(['primer.manufacturer', 'case.manufacturer'])
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

  it('reports a target sheet whose load is missing', () => {
    const sheet = userRecord.parse({ ...sheetRecord, data: { ...sheetRecord.data, load: 'gone' } })
    expect(checkUserRefs([sheet])).toEqual([
      { record: 't1', kind: 'targetSheet', field: 'load', target: 'gone' },
    ])
    expect(checkUserRefs([sheet, userRecord.parse({ ...loadRecord, id: 'gone' })])).toEqual([])
  })
})
