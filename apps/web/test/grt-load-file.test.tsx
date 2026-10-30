import { MantineProvider } from '@mantine/core'
import type { UserRecord } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { type CardActions, FileCard } from '../src/components/import-entry.tsx'
import { english } from '../src/i18n/translate.ts'
import { type ImportReply, type ImportRequest, importWorker } from '../src/lib/import-entry.ts'
import {
  type LoadFileFormat,
  loadFileFormats,
  parseFiles,
  readLoadFile,
} from '../src/lib/load-file-formats.ts'
import { linkedRecordsOf, userDataText } from '../src/lib/user-data.ts'

/** An invented GRT load file: one load of an invented cartridge, bullet and powder. */
const grtText = (title = 'Testcal%20load', charge = '0.45') =>
  [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>',
    "<GordonsReloadingTool version='1.0'>",
    '<InnerBallistikInput>',
    `<title>${title}</title>`,
    '<caliber><input name="CaliberName" value="9.1%20x%2040%20Testcal" unit="" />',
    '<input name="oal" value="58.2" unit="mm" /><input name="casevol" value="2.9" unit="cm3" /></caliber>',
    '<projectile><input name="ProjectileName" value="Inventa%20RN%20120" unit="" />',
    '<input name="mname" value="Inventa%20Arms" unit="" /><input name="mp" value="7.8" unit="g" /></projectile>',
    '<propellant><input name="pname" value="TP%2010" unit="" />',
    `<input name="mc" value="${charge}" unit="g" /></propellant>`,
    '</InnerBallistikInput>',
    '</GordonsReloadingTool>',
  ].join('\r\n')

const bytes = (text: string) => new TextEncoder().encode(text)
const encoded = (text: string) => bytes(text).buffer as ArrayBuffer
const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)
const noActions: CardActions = {
  remove: () => {},
  setKind: () => {},
  setColumn: () => {},
  open: () => {},
  setSource: () => {},
  saveMapping: () => {},
}

const load: UserRecord = {
  kind: 'load',
  id: 'w1',
  name: '308 Win.',
  saved: '2026-10-13T10:00:00.000Z',
  data: { origin: 'user', charge: { value: 2.8 }, cartridge: 'catalogue:308-win' },
}

/** The Import entry's worker over an in-memory store, answering one request at a time. */
function storeWorker() {
  let stored: UserRecord[] = []
  const replies: ImportReply[] = []
  const handle = importWorker(
    {
      records: async () => stored,
      put: (rs) => {
        const ids = new Set(rs.map((r) => r.id))
        stored = [...stored.filter((r) => !ids.has(r.id)), ...rs]
        return Promise.resolve()
      },
    },
    (r) => replies.push(r),
  )
  const ask = async (m: ImportRequest) => {
    await handle(m)
    const r = replies.pop()
    if (!r) throw new Error('no reply')
    return r
  }
  return { ask, stored: () => stored }
}

describe('GRT load files', () => {
  const grt = loadFileFormats.find((f) => f.name === 'GRT load file')

  it('are told by their content, and no other file is', () => {
    const format = grt as LoadFileFormat
    expect(format.detect(bytes(grtText()))).toBe(true)
    expect(format.detect(bytes(`\uFEFF  ${grtText()}`))).toBe(true)
    for (const other of [
      userDataText([load]),
      'Shot,Velocity (fps)\n1,2800\n2,2810',
      '<?xml version="1.0"?><workbook/>',
      `<!-- GordonsReloadingTool -->`,
      `<!-- note --><?xml version="1.0"?><workbook/><GordonsReloadingTool/>`,
      `<?xml version="1.0"?><!-- not closed <GordonsReloadingTool>`,
    ])
      expect(format.detect(bytes(other)), other).toBe(false)
  })

  it('are told after the comments and processing instructions the XML reader takes before the root', async () => {
    const format = grt as LoadFileFormat
    const [declaration, ...rest] = grtText().split('\r\n')
    const body = rest.join('\r\n')
    const long = `<!-- ${'x'.repeat(2000)} -->`
    for (const text of [
      `${declaration}\r\n<!-- saved by hand -->\r\n${body}`,
      `<!-- first -->${declaration}<?style a?>\n${long}\n${body}`,
    ]) {
      expect(format.detect(bytes(text)), text.slice(0, 60)).toBe(true)
      const read = await readLoadFile(bytes(text))
      expect(read.ok).toBe(true)
    }
  })

  it('open to a valid load that names its cartridge, bullet and powder, which an Open stores with it', async () => {
    const read = await readLoadFile(bytes(grtText()))
    if (!read.ok) throw new Error(read.reason)
    expect(read.records.map((r) => r.kind)).toEqual([
      'cartridge',
      'manufacturer',
      'bullet',
      'powder',
      'load',
    ])
    expect(read.unmapped).toEqual(['caliber.casevol'])
    const opened = read.records.find((r) => r.kind === 'load')
    if (!opened) throw new Error('no load')
    expect(
      linkedRecordsOf(opened, read.records)
        .map((r) => r.kind)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['bullet', 'cartridge', 'manufacturer', 'powder'])
  })

  it('a broken file is skipped with its reason', async () => {
    const { skipped } = await parseFiles(
      [{ name: 'broken.grtload', bytes: bytes(grtText().replace('</title>', '')) }],
      undefined,
      english.t,
    )
    expect(skipped).toEqual([
      {
        name: 'broken.grtload',
        reason: expect.stringMatching(/^The file is not a readable GRT load file: /),
      },
    ])
  })

  it('an OpenReloading file carries the records its load names to an Open as well', async () => {
    const bullet: UserRecord = {
      kind: 'bullet',
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Invented 150',
      saved: load.saved,
      data: { origin: 'user', overrides: { name: 'Invented 150' } },
    }
    const named: UserRecord = { ...load, data: { ...load.data, bullet: `user:${bullet.id}` } }
    const read = await readLoadFile(bytes(userDataText([named, bullet])))
    if (!read.ok) throw new Error(read.reason)
    expect(linkedRecordsOf(named, read.records)).toEqual([bullet])
    expect(linkedRecordsOf(bullet, read.records)).toEqual([])
  })

  it('carries the manufacturer of a linked case once, also when the load names it too', () => {
    const maker: UserRecord = {
      kind: 'manufacturer',
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Own brass works',
      saved: load.saved,
      data: { origin: 'user' },
    }
    const brass: UserRecord = {
      kind: 'case',
      id: '00000000-0000-4000-8000-000000000003',
      name: 'Fired twice',
      saved: load.saved,
      data: {
        origin: 'user',
        cartridge: 'catalogue:308-win',
        material: 'brass',
        manufacturer: `user:${maker.id}`,
      },
    }
    const named: UserRecord = {
      ...load,
      data: { ...load.data, case: { record: `user:${brass.id}` } },
    }
    expect(linkedRecordsOf(named, [named, brass, maker])).toEqual([brass, maker])
    const both: UserRecord = {
      ...load,
      data: {
        ...load.data,
        case: { record: `user:${brass.id}`, manufacturer: `user:${maker.id}` },
      },
    }
    expect(linkedRecordsOf(both, [both, brass, maker])).toEqual([brass, maker])
  })
})

it('reads ten load files with one plan each, skips a broken one and imports the rest once', async () => {
  const h = storeWorker()
  const texts = [
    ...Array.from({ length: 9 }, (_, i) => grtText(`Load%20${i}`, `0.4${i}`)),
    grtText().replace('</InnerBallistikInput>', ''),
  ]
  const entries = []
  for (const [i, text] of texts.entries()) {
    const r = await h.ask({ type: 'read', id: i + 1, bytes: encoded(text) })
    if (r.type !== 'read') throw new Error(`reply ${r.type}`)
    entries.push({ id: i + 1, name: `${i}.grtload`, card: r.card, build: r.build })
  }
  expect(entries[0]?.card).toEqual({
    format: 'GRT load file',
    records: 5,
    kinds: { cartridge: 1, bullet: 1, powder: 1, load: 1 },
    warnings: [],
    unmapped: ['caliber.casevol'],
  })
  expect(entries[9]?.card).toMatchObject({ format: 'GRT load file', refusal: expect.any(String) })
  expect(entries[9]?.build).toBeUndefined()
  const shown = html(
    <FileCard
      e={{ ...entries[0], id: 1, name: '0.grtload', source: '', touched: false, busy: false }}
      shared=""
      actions={noActions}
    />,
  )
  expect(shown).toContain('1 load, 1 cartridge, 1 bullet, 1 powder')
  // the components the files share are planned in each file, written once
  expect(entries[0]?.build).toMatchObject({ added: 4, equal: 0 })
  const imported = { source: 'GRT load file', file: '0.grtload', day: '2026-10-30' }
  for (const e of entries.slice(0, 9))
    await h.ask({ type: 'commit', id: e.id, imported, replace: false })
  // 9 loads, one each of cartridge, maker, bullet and powder
  expect(h.stored()).toHaveLength(13)
  expect(h.stored().every((r) => r.imported?.source === 'GRT load file')).toBe(true)

  const again = await h.ask({ type: 'read', id: 20, bytes: encoded(texts[0] ?? '') })
  expect(again).toMatchObject({ build: { added: 0, equal: 4, changed: 0 } })
  const done = await h.ask({ type: 'commit', id: 20, imported, replace: false })
  expect(done).toMatchObject({ type: 'committed', written: 0 })
  expect(h.stored()).toHaveLength(13)
})
