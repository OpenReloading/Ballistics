import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalJson } from '../src/canonical-json.ts'
import { readShareLink, shareLinkOf } from '../src/share-link.ts'
import { userRecord } from '../src/user-data.ts'
import { readUserDataFile } from '../src/user-data-file.ts'

// After a deliberate format change (new version, new files) `vitest run test/format-goldens.test.ts --update` rewrites the file goldens; a link golden is the fragment `shareLinkOf` writes, checked inflated since deflate bytes differ between zlib builds.
const saved = '2026-10-13T10:00:00.000Z'
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const user = (n: number) => `user:${id(n)}`

const manufacturer = {
  kind: 'manufacturer',
  id: id(1),
  name: 'Büchsenmacher Müller',
  saved,
  data: { origin: 'user' },
}
const bullet = {
  kind: 'bullet',
  id: id(2),
  name: '168 gr boat tail',
  saved,
  data: {
    origin: 'user',
    manufacturer: user(1),
    basedOn: 'catalogue:alpha-30425',
    basedOnRevision: 'r1',
    overrides: { diameter: { value: 7.82 }, mass: { value: 10.886 }, base: { angle: null } },
  },
}
const cartridge = {
  kind: 'cartridge',
  id: id(3),
  name: 'Wildcat',
  saved,
  data: {
    origin: 'user',
    overrides: {
      table: 'I',
      values: [{ side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51.18 }],
    },
  },
}
const powder = {
  kind: 'powder',
  id: id(4),
  name: 'Draft powder',
  saved,
  data: {
    origin: 'user',
    provenanceKind: 'fitted',
    draft: {
      grainForm: 'extruded',
      propellantBase: 'double',
      bulkDensity: { value: 0.9 },
      composition: [{ name: 'Nitrocellulose', min: 60, max: 100 }],
    },
  },
}
const caseCapacity = {
  kind: 'caseCapacity',
  id: id(5),
  name: 'Measured',
  saved,
  data: {
    origin: 'user',
    cartridge: user(3),
    caseManufacturer: user(1),
    waterCapacity: { value: 3.5 },
  },
}
const load = {
  kind: 'load',
  id: id(6),
  name: 'Range load',
  saved,
  data: {
    origin: 'user',
    charge: { value: 2.8 },
    cartridge: 'catalogue:308-win',
    bullet: user(2),
    powder: user(4),
    capacity: user(5),
    firearm: user(7),
    sessions: [user(8)],
  },
  imported: { source: 'Maker load data 2026', file: 'loads.csv', day: '2026-10-20' },
}
const firearm = {
  kind: 'firearm',
  id: id(7),
  name: 'Jagdbüchse',
  saved,
  data: {
    origin: 'user',
    name: 'Jagdbüchse',
    manufacturer: user(1),
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
    ],
    configurations: [
      {
        id: 'c1',
        name: 'Scope',
        mounts: [{ optic: 'o1', sightHeight: { value: 55 }, zeroRange: { value: 100000 } }],
        mounted: '2026-04-01',
      },
    ],
    active: 'c1',
  },
}
const session = {
  kind: 'session',
  id: id(8),
  name: 'Chronograph day',
  saved,
  data: {
    origin: 'user',
    device: { kind: 'doppler-radar', manufacturer: user(1), model: 'Radar' },
    muzzleDistance: { value: 3000 },
    strings: [
      {
        label: 'A',
        load: user(6),
        shots: [{ velocity: { value: 800 } }, { velocity: { value: 790 }, excluded: 'flyer' }],
      },
    ],
    provenance: { kind: 'measured', sources: [{ title: 'day1.csv' }] },
  },
}
const targetSheet = {
  kind: 'targetSheet',
  id: id(9),
  name: 'Ladder sheet',
  saved,
  data: {
    photo: 'photo-1',
    references: [],
    targetRotation: 0,
    load: id(6),
    groups: [
      {
        id: 'g1',
        name: 'Step 1',
        colour: '#d9480f',
        distance: 100,
        ladderStep: 0,
        shots: [
          {
            x: 0.003,
            y: -0.001,
            placement: 'placed',
            chrono: { session: user(8), string: 0, shot: 1 },
          },
        ],
      },
    ],
  },
}
const targetFaceDesign = {
  kind: 'targetFaceDesign',
  id: id(10),
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
}
const cartridgeCase = {
  kind: 'case',
  id: id(11),
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
}
const event = {
  kind: 'event',
  id: id(12),
  name: 'Landesmeisterschaft 25 m',
  saved,
  data: {
    date: '2026-06-14',
    place: 'Hannover',
    eventType: 'catalogue:dsb-meisterschaft',
    level: 'Landesmeisterschaft',
    discipline: 'catalogue:dsb-25m-sportpistole',
    firearm: user(7),
    state: 'completed',
    results: {
      method: 'rings',
      series: [{ shots: [10, 9, 10, 8, 9], targetSheet: user(9) }, { total: 47 }],
    },
  },
}
const shootingLogEntry = {
  kind: 'shootingLogEntry',
  id: id(13),
  name: '2026-10-12 Range',
  saved,
  data: {
    date: '2026-10-12',
    rounds: 30,
    place: 'Club range',
    discipline: 'catalogue:dsb-1-35',
    firearm: user(7),
    load: user(6),
    result: '285 rings',
    event: user(12),
    notes: 'Wind from the left',
    confirmation: { by: 'Range officer', date: '2026-10-12' },
  },
}

const everyKind = [
  manufacturer,
  bullet,
  cartridge,
  powder,
  caseCapacity,
  load,
  firearm,
  session,
  targetSheet,
  targetFaceDesign,
  cartridgeCase,
  event,
  shootingLogEntry,
]
// a 1 x 1 pixel PNG
const photo = {
  id: 'photo-1',
  type: 'image/png',
  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
}

const cases = {
  'v1-empty': { format: 'openreloading-user-data', version: 1, records: [] },
  'v1-every-kind': {
    format: 'openreloading-user-data',
    version: 1,
    records: everyKind,
    files: [photo],
  },
}
const names = Object.keys(cases) as (keyof typeof cases)[]

/** Keys sorted at every depth, indented two spaces, one trailing newline: what a golden file holds. */
const fileText = (value: unknown) =>
  `${JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)}\n`

const goldenUrl = (dir: string, name: string, extension: string) =>
  new URL(`golden/${dir}/${name}.${extension}`, import.meta.url)
const golden = (dir: string, name: string, extension: string) =>
  readFileSync(goldenUrl(dir, name, extension), 'utf8')

const page = 'https://example.test/records'
const fragment = (link: string | undefined) => link?.slice(page.length)

/** A payload as `shareLinkOf` packs it, for any text. */
async function packed(text: string) {
  const stream = new Blob([new TextEncoder().encode(text)])
    .stream()
    .pipeThrough(new CompressionStream('deflate-raw'))
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer())
  const b64 = btoa(String.fromCharCode(...bytes))
  return `#record=${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
}

/** The text a `#record=` fragment holds: inflate output is fixed by RFC 1951, deflate output is not. */
async function unpacked(link: string) {
  const binary = atob(link.slice('#record='.length).replace(/-/g, '+').replace(/_/g, '/'))
  const stream = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

describe('user data file goldens', () => {
  it.each(names)('%s is rebuilt from its records', async (name) => {
    await expect(fileText(cases[name])).toMatchFileSnapshot(
      goldenUrl('user-data', name, 'json').pathname,
    )
  })

  it.each(names)('%s parses and writes back byte-identical', (name) => {
    const text = golden('user-data', name, 'json')
    const read = readUserDataFile(text)
    if (!read.ok) throw new Error(JSON.stringify(read.diagnostic))
    expect(read.skipped).toBeUndefined()
    expect(fileText({ ...JSON.parse(text), records: read.records, files: read.files })).toBe(text)
  })

  it('holds one record of every kind the schema has', () => {
    const read = readUserDataFile(golden('user-data', 'v1-every-kind', 'json'))
    expect(read.ok && read.records.map((r) => r.kind)).toEqual(
      userRecord.options.map((o) => o.shape.kind.value),
    )
  })

  it.each(names)('%s of version 2 is refused as a whole', (name) => {
    expect(readUserDataFile(JSON.stringify({ ...cases[name], version: 2 }))).toEqual({
      ok: false,
      diagnostic: { code: 'otherVersion', params: { version: 2, readVersion: 1 } },
    })
  })
})

describe('share link goldens', () => {
  it.each(names)('%s inflates to the payload of its file golden', async (name) => {
    const read = readUserDataFile(golden('user-data', name, 'json'))
    if (!read.ok) throw new Error(JSON.stringify(read.diagnostic))
    expect(await unpacked(golden('share-link', name, 'txt'))).toBe(
      JSON.stringify({ format: 'openreloading-user-data', version: 1, records: read.records }),
    )
  })

  it.each(names)('%s reads back to its records, and so does a link of them', async (name) => {
    const expected = readUserDataFile(golden('user-data', name, 'json'))
    const read = await readShareLink(golden('share-link', name, 'txt'))
    if (!expected.ok || !read?.ok) throw new Error('a golden is not read')
    expect(read.records).toEqual(expected.records)
    const again = await readShareLink(fragment(await shareLinkOf(read.records, page)) ?? '')
    expect(again?.ok && again.records).toEqual(expected.records)
  })

  it.each(names)('%s of version 2 is refused as a whole', async (name) => {
    const link = await packed(JSON.stringify({ ...cases[name], version: 2, files: undefined }))
    expect(await readShareLink(link)).toEqual({
      ok: false,
      diagnostic: { code: 'otherVersion', params: { version: 2, readVersion: 1 } },
    })
  })
})
