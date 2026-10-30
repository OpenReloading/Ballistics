import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { type ImportReply, type ImportRequest, importWorker } from '../src/lib/import-entry.ts'
import {
  type LoadFileFormat,
  loadFileFormats,
  loadFormatOf,
  parseFiles,
  readLoadFile,
} from '../src/lib/load-file-formats.ts'
import { linkedRecordsOf, userDataText } from '../src/lib/user-data.ts'

/** An invented ChamberSim Reloaded load file: one load of an invented cartridge, bullet and powder, with one measurement series. */
const csrText = (title = 'Testcal%20ladder', charge = '2.15') =>
  [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<ChamberSimReloaded format="1" version="9.9">',
    '<load>',
    `<title>${title}</title>`,
    '<caliber><input name="CaliberName" value="7.1%20x%2048%20Testcal" unit=""/>',
    '<input name="oal" value="70.4" unit="mm"/><input name="casevol" value="3.1" unit="cm3"/></caliber>',
    '<projectile><input name="ProjectileName" value="Inventa%20BT%20140" unit=""/>',
    '<input name="mname" value="Inventa%20Arms" unit=""/><input name="mp" value="9.1" unit="g"/></projectile>',
    '<propellant><input name="pname" value="TP%2020" unit=""/>',
    `<input name="mc" value="${charge}" unit="g"/></propellant>`,
    '<appendix><Measurement><charge name="A" value="0.0021"><shot velocity="701.5"/><shot velocity="705"/></charge></Measurement></appendix>',
    '</load>',
    '</ChamberSimReloaded>',
  ].join('\n')

const grtText = [
  '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>',
  "<GordonsReloadingTool version='1.0'><InnerBallistikInput><title>T</title></InnerBallistikInput></GordonsReloadingTool>",
].join('\r\n')

const load: UserRecord = {
  kind: 'load',
  id: 'w1',
  name: '308 Win.',
  saved: '2026-10-13T10:00:00.000Z',
  data: { origin: 'user', charge: { value: 2.8 } },
}

const bytes = (text: string) => new TextEncoder().encode(text)
const encoded = (text: string) => bytes(text).buffer as ArrayBuffer

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

describe('ChamberSim Reloaded load files', () => {
  const csr = loadFileFormats.find((f) => f.name === 'ChamberSim Reloaded load file')

  it('are told by their content, and no other file is', () => {
    const format = csr as LoadFileFormat
    expect(format.detect(bytes(csrText()))).toBe(true)
    expect(format.detect(bytes(`﻿  ${csrText()}`))).toBe(true)
    expect(loadFormatOf(bytes(csrText()))?.name).toBe('ChamberSim Reloaded load file')
    expect(loadFormatOf(bytes(grtText))?.name).toBe('GRT load file')
    for (const other of [
      userDataText([load]),
      'Shot,Velocity (fps)\n1,2800\n2,2810',
      grtText,
      '<?xml version="1.0"?><workbook/>',
      '<!-- ChamberSimReloaded -->',
      '<!-- note --><?xml version="1.0"?><workbook/><ChamberSimReloaded/>',
      '<?xml version="1.0"?><!-- not closed <ChamberSimReloaded>',
    ])
      expect(format.detect(bytes(other)), other).toBe(false)
  })

  it('are told after the comments and processing instructions the XML reader takes before the root', async () => {
    const format = csr as LoadFileFormat
    const [declaration, ...rest] = csrText().split('\n')
    const body = rest.join('\n')
    const long = `<!-- ${'x'.repeat(2000)} -->`
    for (const text of [
      `${declaration}\n<!-- saved by hand -->\n${body}`,
      `<!-- first -->${declaration}<?style a?>\n${long}\n${body}`,
    ]) {
      expect(format.detect(bytes(text)), text.slice(0, 60)).toBe(true)
      const read = await readLoadFile(bytes(text))
      expect(read.ok).toBe(true)
    }
  })

  it('open to a valid load that an Open stores with its components and measurement series', async () => {
    const read = await readLoadFile(bytes(csrText()))
    if (!read.ok) throw new Error(read.reason)
    expect(read.records.map((r) => r.kind)).toEqual([
      'cartridge',
      'manufacturer',
      'bullet',
      'powder',
      'load',
      'session',
    ])
    expect(read.unmapped).toEqual(['caliber.casevol'])
    const opened = read.records.find((r) => r.kind === 'load')
    if (!opened) throw new Error('no load')
    expect(
      linkedRecordsOf(opened, read.records)
        .map((r) => r.kind)
        .sort((a, b) => a.localeCompare(b)),
    ).toEqual(['bullet', 'cartridge', 'manufacturer', 'powder', 'session'])
  })

  it('a broken file is skipped with its reason', async () => {
    const { skipped } = await parseFiles(
      [{ name: 'broken.csrload', bytes: bytes(csrText().replace('</title>', '')) }],
      undefined,
      english.t,
    )
    expect(skipped).toEqual([
      {
        name: 'broken.csrload',
        reason: expect.stringMatching(
          /^The file is not a readable ChamberSim Reloaded load file: /,
        ),
      },
    ])
  })
})

it('reads ten ChamberSim Reloaded files, skips a broken one and imports the rest once', async () => {
  const h = storeWorker()
  const texts = [
    ...Array.from({ length: 9 }, (_, i) => csrText(`Load%20${i}`, `2.1${i}`)),
    csrText().replace('</load>', ''),
  ]
  const cards = []
  for (const [i, text] of texts.entries()) {
    const r = await h.ask({ type: 'read', id: i + 1, bytes: encoded(text) })
    if (r.type !== 'read') throw new Error(`reply ${r.type}`)
    cards.push(r.card)
  }
  expect(cards[0]).toEqual({
    format: 'ChamberSim Reloaded load file',
    records: 6,
    kinds: { cartridge: 1, bullet: 1, powder: 1, load: 1, session: 1 },
    warnings: [],
    unmapped: ['caliber.casevol'],
  })
  expect(cards[9]).toMatchObject({ refusal: expect.any(String) })
  const imported = { source: 'ChamberSim Reloaded load file', file: '0.csrload', day: '2026-10-30' }
  for (let id = 1; id <= 9; id++) await h.ask({ type: 'commit', id, imported, replace: false })
  // 9 loads and 9 sessions, one each of cartridge, maker, bullet and powder
  expect(h.stored()).toHaveLength(22)

  const again = await h.ask({ type: 'read', id: 20, bytes: encoded(texts[0] ?? '') })
  expect(again).toMatchObject({ build: { added: 0, equal: 5, changed: 0 } })
  const done = await h.ask({ type: 'commit', id: 20, imported, replace: false })
  expect(done).toMatchObject({ type: 'committed', written: 0 })
  expect(h.stored()).toHaveLength(22)
})
