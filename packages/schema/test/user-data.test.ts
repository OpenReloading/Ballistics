import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  checkUserRefs,
  firearm,
  units,
  userDataFile,
  userDataFormat,
  userDataVersion,
  userRecord,
  versionProblem,
} from '../src/index.ts'

const saved = '2026-10-13T10:00:00.000Z'
const uuid = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
const bulletRecord = {
  kind: 'bullet',
  id: 'a1b2',
  name: 'Manufacturer 168 gr',
  saved,
  data: {
    origin: 'user',
    manufacturerName: 'Manufacturer',
    basedOn: 'catalogue:alpha-30425',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.886 },
      base: { type: 'boat-tail', angle: null },
    },
  },
} as const
const cartridgeRecord = {
  kind: 'cartridge',
  id: 'c3',
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
  kind: 'workbenchState',
  id: 'w4',
  name: 'Load',
  saved,
  data: { siValues: { charge: 0.0028 }, cartridge: '308-win', notes: '' },
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
    manufacturerName: 'Manufacturer',
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

const file = (records: unknown[], version: unknown = userDataVersion) => ({
  format: userDataFormat,
  version,
  records,
})

describe('userDataFile', () => {
  it('accepts every record kind', () => {
    expect(
      userDataFile.safeParse(
        file([bulletRecord, cartridgeRecord, loadRecord, firearmRecord, sheetRecord, faceRecord]),
      ).success,
    ).toBe(true)
  })

  it('takes a face draft with missing values and rejects a non-positive size', () => {
    const draft = { ...faceRecord, data: { rings: [{}], events: [{ name: '' }] } }
    expect(userRecord.safeParse(draft).success).toBe(true)
    const zero = { ...faceRecord, data: { ...faceRecord.data, blackDiameter: 0 } }
    expect(userRecord.safeParse(zero).error?.issues[0].path).toEqual(['data', 'blackDiameter'])
  })

  it('takes a catalogue reference as the base of a variant and refuses another text', () => {
    const basedOn = (text: string) =>
      userRecord.safeParse({ ...bulletRecord, data: { ...bulletRecord.data, basedOn: text } })
        .success
    expect(basedOn('catalogue:alpha-30425')).toBe(true)
    for (const bad of ['alpha-30425', 'Alpha 30425', `user:${uuid}`, 'catalogue:Alpha 30425'])
      expect(basedOn(bad)).toBe(false)
  })

  it('saves a variant of a bullet without a base, a mass or a manufacturer id', () => {
    const alone = {
      ...bulletRecord,
      data: { origin: 'user', manufacturerName: '', overrides: { diameter: { value: 7.82 } } },
    }
    expect(userRecord.parse(alone)).toEqual(alone)
    const bare = { ...cartridgeRecord, data: { origin: 'user' } }
    expect(userRecord.parse(bare)).toEqual(bare)
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
      expect(userRecord.safeParse({ ...bulletRecord, kind }).error?.issues[0].path).toEqual([
        'kind',
      ])
  })

  it('rejects two records with one id', () => {
    const twin = { ...loadRecord, name: 'Another load' }
    expect(userDataFile.safeParse(file([loadRecord, twin])).error?.issues[0].path).toEqual([
      'records',
    ])
  })

  it('rejects another format and a newer version', () => {
    expect(userDataFile.safeParse({ ...file([]), format: 'other' }).success).toBe(false)
    expect(userDataFile.safeParse(file([], 5)).error?.issues[0].path).toEqual(['version'])
  })

  it('rejects an unknown kind, a bad date, a non-finite value and an invalid spec value', () => {
    const paths = (r: object) => userRecord.safeParse(r).error?.issues.map((i) => i.path.join('.'))
    expect(paths({ ...bulletRecord, kind: 'powder' })).toEqual(['kind'])
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

describe('workbenchState ladder', () => {
  const withLadder = (ladder: unknown) => ({
    ...loadRecord,
    data: { ...loadRecord.data, ladder },
  })

  it('keeps a ladder and opens a load without one', () => {
    const ladder = { stepCount: 3, chargeStep: 0.0001, direction: 'down' }
    expect(userRecord.parse(withLadder(ladder))).toEqual(withLadder(ladder))
    expect(userRecord.parse(withLadder({ stepCount: 2, direction: 'up' })).data).toHaveProperty(
      'ladder.stepCount',
      2,
    )
    expect(userRecord.parse(loadRecord).data).not.toHaveProperty('ladder')
  })

  it('keeps a ladder kind, opens a load without one as the charge and rejects an unknown kind', () => {
    const seating = { kind: 'seating', stepCount: 3, chargeStep: 0.0005, direction: 'up' }
    expect(userRecord.parse(withLadder(seating))).toEqual(withLadder(seating))
    const { kind: _, ...older } = seating
    expect(userRecord.parse(withLadder(older)).data).not.toHaveProperty('ladder.kind')
    const temperature = { ...seating, kind: 'temperature', chargeStep: 5 }
    expect(userRecord.parse(withLadder(temperature))).toEqual(withLadder(temperature))
    expect(userRecord.safeParse(withLadder({ ...seating, kind: 'Seating' })).success).toBe(false)
  })

  it('rejects a step count outside 2 to 21, a step of 0, an unknown direction and an even count around', () => {
    expect(userRecord.safeParse(withLadder({ stepCount: 21, direction: 'around' })).success).toBe(
      true,
    )
    for (const ladder of [
      { stepCount: 1, direction: 'up' },
      { stepCount: 22, direction: 'up' },
      { stepCount: 4, direction: 'around' },
      { stepCount: 2.5, direction: 'up' },
      { stepCount: 3, chargeStep: 0, direction: 'up' },
      { stepCount: 3, direction: 'sideways' },
    ])
      expect(userRecord.safeParse(withLadder(ladder)).success).toBe(false)
  })
})

describe('workbenchState seating, measured capacity and firearm', () => {
  const withData = (data: object) => ({ ...loadRecord, data: { ...loadRecord.data, ...data } })
  const kept = withData({
    measuredWaterCapacity: 3.52e-6,
    firearm: 'f5',
    seating: { by: 'overallLength', value: 0.0708 },
  })

  it('keeps them through a round trip', () => {
    expect(userRecord.parse(kept)).toEqual(kept)
    const baseToOgive = withData({ seating: { by: 'baseToOgive', value: 0.0545 } })
    expect(userRecord.parse(baseToOgive)).toEqual(baseToOgive)
  })

  it('opens an older load without them unchanged', () => {
    const data = userRecord.parse(loadRecord).data
    for (const k of ['measuredWaterCapacity', 'firearm', 'seating'])
      expect(data).not.toHaveProperty(k)
    expect(userDataFile.parse(file([loadRecord])).records).toEqual([loadRecord])
  })

  it('rejects a capacity or seating of 0, an unknown seating mode and an empty firearm id', () => {
    for (const data of [
      { measuredWaterCapacity: 0 },
      { seating: { by: 'overallLength', value: 0 } },
      { seating: { by: 'depth', value: 0.07 } },
      { firearm: '' },
    ])
      expect(userRecord.safeParse(withData(data)).success).toBe(false)
  })
})

describe('workbenchState measurements', () => {
  const withData = (data: object) => ({ ...loadRecord, data: { ...loadRecord.data, ...data } })
  const series = {
    name: 'day1.csv',
    date: '2026-10-12',
    device: 'Manufacturer Radar',
    muzzleDistance: 3,
    strings: [
      {
        label: 'A',
        charge: 0.00248,
        shots: [{ velocity: { value: 800 } }, { velocity: { value: 790 }, excluded: 'flyer' }],
      },
      { shots: [{ velocity: { value: 810, raw: '2657' }, coldBore: true }] },
    ],
  }

  it('keeps the series through a round trip and opens a load without them unchanged', () => {
    const kept = withData({ measurements: [series, { name: 'day2.csv', strings: [] }] })
    expect(userRecord.parse(kept)).toEqual(kept)
    expect(userRecord.parse(loadRecord).data).not.toHaveProperty('measurements')
  })

  it('rejects a charge of 0, a shot without a velocity, a long name and too many series', () => {
    const string = series.strings[0]
    for (const measurements of [
      [{ ...series, strings: [{ ...string, charge: 0 }] }],
      [{ ...series, strings: [{ shots: [{}] }] }],
      [{ ...series, name: 'x'.repeat(201) }],
      Array.from({ length: 51 }, () => series),
    ])
      expect(userRecord.safeParse(withData({ measurements })).success).toBe(false)
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

  it('takes a catalogue maker only, and one schema for every origin', () => {
    expect(paths({ manufacturer: 'user:2f6c1f3e-9b5a-4a8e-8f21-3c1d7a5b9e10' })).toEqual([
      'data.manufacturer',
    ])
    for (const origin of ['catalogue', 'user', 'shared'])
      expect(firearm.safeParse({ ...firearmRecord.data, origin }).success).toBe(true)
    expect(paths({ origin: 'cloud' })).toEqual(['data.origin'])
  })

  it('stores every quantity in the one unit of its kind', () => {
    const props = z.toJSONSchema(firearm).properties as Record<string, { unit?: string }>
    expect(
      Object.fromEntries(
        ['barrelLength', 'twist', 'grooveDiameter', 'firearmMass'].map((k) => [k, props[k].unit]),
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

describe('checkUserRefs', () => {
  const withFirearm = (firearm: string) =>
    userRecord.parse({ ...loadRecord, data: { ...loadRecord.data, firearm } })
  const firearm = userRecord.parse(firearmRecord)

  it('reports a workbench that points at a missing firearm', () => {
    expect(checkUserRefs([withFirearm('gone')])).toEqual([
      { record: 'w4', kind: 'workbenchState', field: 'firearm', target: 'gone' },
    ])
  })

  it('reports a firearm id that names a record of another kind', () => {
    const other = userRecord.parse({ ...bulletRecord, id: 'f5' })
    expect(checkUserRefs([withFirearm('f5'), other])).toHaveLength(1)
  })

  it('reports nothing for a firearm that is there, as an old id or a user reference', () => {
    expect(checkUserRefs([withFirearm('f5'), firearm])).toEqual([])
    const own = { ...firearm, id: uuid }
    expect(checkUserRefs([withFirearm(`user:${uuid}`), own])).toEqual([])
    expect(checkUserRefs([withFirearm(`user:${uuid}`)])).toHaveLength(1)
  })

  it('leaves a catalogue reference and a record without references alone', () => {
    expect(checkUserRefs([withFirearm('catalogue:some-rifle')])).toEqual([])
    expect(checkUserRefs([userRecord.parse(loadRecord), userRecord.parse(bulletRecord)])).toEqual(
      [],
    )
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
      { record: 'w4', kind: 'workbenchState', field: 'cartridge', target: `user:${uuid}` },
    ])
    // a design of the other kind under that id does not answer
    expect(checkUserRefs([withRefs('308-win', `user:${uuid}`), own[0] as never])).toHaveLength(1)
  })

  it('opens a load that names its cartridge and bullet by plain id or by reference', () => {
    for (const [cartridge, bullet] of [
      ['308-win', 'alpha-30425'],
      ['catalogue:308-win', `user:${uuid}`],
    ])
      expect(
        userRecord.safeParse({ ...loadRecord, data: { ...loadRecord.data, cartridge, bullet } })
          .success,
      ).toBe(true)
    expect(
      userRecord.safeParse({ ...loadRecord, data: { ...loadRecord.data, bullet: 'user:1' } })
        .success,
    ).toBe(false)
  })

  it('reports a target sheet whose load is missing', () => {
    const sheet = userRecord.parse({ ...sheetRecord, data: { ...sheetRecord.data, load: 'gone' } })
    expect(checkUserRefs([sheet])).toEqual([
      { record: 't1', kind: 'targetSheet', field: 'load', target: 'gone' },
    ])
    expect(checkUserRefs([sheet, userRecord.parse({ ...loadRecord, id: 'gone' })])).toEqual([])
  })
})
