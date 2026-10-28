import { MantineProvider } from '@mantine/core'
import type { UserRecord } from '@open-reloading/schema'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import {
  type CardActions,
  type Entry,
  FileCard,
  folded,
  ImportFoot,
  splitImport,
} from '../src/components/import-entry.tsx'
import {
  type BuildView,
  type CardView,
  firstBuild,
  type ImportReply,
  type ImportRequest,
  importCount,
  importWorker,
  mappingsFor,
} from '../src/lib/import-entry.ts'

const csv = (rows: string[]) =>
  new TextEncoder().encode(['Name,Maker,Diameter (mm),Weight (gr),BC G1', ...rows].join('\n'))
    .buffer as ArrayBuffer

const bullets = [
  'Alpha 150,Invented Arms,7.82,150,0.40',
  'Alpha 168,Invented Arms,7.82,168,0.45',
  'Beta 55,Other Works,5.70,55,0.25',
]

/** The worker's handler over an in-memory store, answering one request at a time. */
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

const built = (r: ImportReply): BuildView => {
  if (r.type !== 'built' && r.type !== 'committed') throw new Error(`reply ${r.type}`)
  return r.build
}

const imported = { source: 'Invented catalogue', file: 'bullets.csv', day: '2026-10-28' }

it('reads a clean table, imports its rows with the source and finds them again on a second import', async () => {
  const h = storeWorker()
  const read = await h.ask({ type: 'read', id: 1, bytes: csv(bullets) })
  if (read.type !== 'read' || 'refusal' in read.card) throw new Error('not read')
  expect(read.card).toMatchObject({ kind: 'bullet', tier: 'high', rows: 3 })
  const first = built(await h.ask({ type: 'build', id: 1, kind: 'bullet' }))
  expect(first).toMatchObject({ added: 3, equal: 0, changed: 0, repeated: 0 })
  expect(first.counts).toEqual({ accepted: 3, warned: 0, rejected: 0 })

  const done = await h.ask({ type: 'commit', id: 1, imported, replace: false })
  expect(done).toMatchObject({ type: 'committed', written: 3 })
  expect(built(done)).toMatchObject({ added: 0, equal: 3 })
  // two makers and three bullets, each with the source of the import
  expect(h.stored()).toHaveLength(5)
  expect(h.stored().every((r) => r.imported?.source === 'Invented catalogue')).toBe(true)

  await h.ask({ type: 'read', id: 2, bytes: csv(bullets) })
  const again = built(await h.ask({ type: 'build', id: 2, kind: 'bullet' }))
  expect(again).toMatchObject({ added: 0, equal: 3, changed: 0 })
  expect(importCount([{ build: again, source: '' }], 'Invented catalogue', false).total).toBe(0)

  const edited = [bullets[0] ?? '', 'Alpha 168,Invented Arms,7.82,168,0.47', bullets[2] ?? '']
  await h.ask({ type: 'read', id: 3, bytes: csv(edited) })
  const changed = built(await h.ask({ type: 'build', id: 3, kind: 'bullet' }))
  expect(changed).toMatchObject({ added: 0, equal: 2, changed: 1 })
  expect(importCount([{ build: changed, source: '' }], 'x', true).total).toBe(1)
})

it('rejects a bad row and keeps the others, counting a repeated row once', async () => {
  const h = storeWorker()
  await h.ask({
    type: 'read',
    id: 1,
    bytes: csv([...bullets, bullets[0] ?? '', 'Gamma,X,abc,150,0.3']),
  })
  const b = built(await h.ask({ type: 'build', id: 1, kind: 'bullet' }))
  expect(b.counts).toMatchObject({ accepted: 4, rejected: 1 })
  expect(b.rejected[0]).toMatchObject({ row: 6, column: 'Diameter (mm)' })
  expect(b).toMatchObject({ added: 3, repeated: 1 })
})

it('refuses a text without a table', async () => {
  const h = storeWorker()
  const r = await h.ask({
    type: 'read',
    id: 1,
    bytes: new TextEncoder().encode('Notes, from the range\nwindy day').buffer as ArrayBuffer,
  })
  expect(r).toMatchObject({ type: 'read', card: { refusal: expect.stringContaining('no table') } })
})

it('keeps the Import button disabled while a file that writes rows has no source', () => {
  const build = { added: 2, changed: 1 } as BuildView
  expect(importCount([{ build, source: '' }], '', false)).toEqual({ total: 2, missingSource: true })
  expect(importCount([{ build, source: '' }], '  ', true).missingSource).toBe(true)
  expect(importCount([{ build, source: 'Own notes' }], '', false).missingSource).toBe(false)
  expect(importCount([{ build, source: '' }], 'Catalogue', false).missingSource).toBe(false)
  // a file that writes nothing needs no source
  expect(
    importCount([{ build: { added: 0, changed: 0 } as BuildView, source: '' }], '', false),
  ).toEqual({
    total: 0,
    missingSource: false,
  })
})

it('offers a saved mapping for a file of the same header and builds the next file with it', () => {
  const header = ['Bezeichnung', 'Kaliber', 'Gewicht']
  const map = [
    { field: 'name', decimal: '.' as const },
    { decimal: '.' as const },
    { field: 'mass', unit: 'gr', decimal: ',' as const },
  ]
  const saved = {
    'My shop': { kind: 'bullet' as const, header, map },
    Other: { kind: 'powder' as const, header: ['Name', 'Density'], map: [] },
  }
  expect(mappingsFor(saved, header)).toEqual(['My shop'])
  expect(mappingsFor(saved, ['Bezeichnung', 'Gewicht', 'Kaliber'])).toEqual([])
  const card: CardView = {
    header,
    samples: [],
    rows: 1,
    scores: [],
    kind: 'cartridge',
    tier: 'low',
  }
  expect(firstBuild(card, saved)).toEqual({ kind: 'bullet', map, mapping: 'My shop' })
  expect(firstBuild({ ...card, header: ['Name', 'Kaliber'] }, saved)).toEqual({
    kind: 'cartridge',
    map: undefined,
    mapping: undefined,
  })
  expect(firstBuild({ refusal: 'no table' }, saved)).toBeUndefined()
})

const html = (node: React.ReactNode) =>
  renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

/** The tab stops of rendered markup: each enabled button, input and select, a radio group once. */
function tabStops(markup: string) {
  const stops: string[] = []
  const groups = new Set<string>()
  for (const m of markup.matchAll(/<(button|input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2] ?? ''
    if (/\sdisabled=""/.test(attrs) || /type="hidden"/.test(attrs)) continue
    const radio = /type="radio"/.test(attrs) && /name="([^"]+)"/.exec(attrs)?.[1]
    if (radio) {
      if (groups.has(radio)) continue
      groups.add(radio)
    }
    stops.push(m[1] ?? '')
  }
  return stops
}

const noActions: CardActions = {
  remove: () => {},
  setKind: () => {},
  setColumn: () => {},
  open: () => {},
  setSource: () => {},
  saveMapping: () => {},
}

const tableCard: CardView = {
  header: ['Name', 'Diameter (mm)', 'Weight (gr)'],
  samples: [['Alpha'], ['7.82'], ['150']],
  rows: 1,
  scores: [{ kind: 'bullet', score: 0.9 }],
  kind: 'bullet',
  tier: 'high',
}

const entry: Entry = {
  id: 1,
  name: 'bullets.csv',
  card: tableCard,
  kind: 'bullet',
  map: [
    { field: 'name', decimal: '.' },
    { field: 'diameter', unit: 'mm', decimal: '.' },
    { field: 'mass', unit: 'gr', decimal: '.' },
  ],
  source: '',
  touched: false,
  busy: false,
}

it('folds a high-tier card to 2 tab stops and opens every control of it unfolded', () => {
  expect(folded(entry)).toBe(true)
  const shut = html(<FileCard e={entry} shared="" actions={noActions} />)
  expect(tabStops(shut)).toHaveLength(2)
  expect(shut).toContain('Table of bullets (high)')
  expect(shut).toContain('Kind and columns')
  const open = html(<FileCard e={{ ...entry, touched: true }} shared="" actions={noActions} />)
  // Remove, the kind, field of the name column, field, unit and decimal mark of the two number
  // columns, Save mapping as (Save mapping is disabled while it is empty), the source of the file
  expect(tabStops(open)).toHaveLength(1 + 1 + 1 + 3 + 3 + 1 + 1)
  expect(open).toContain('Table of bullets (chosen)')
  expect(open).toContain('Source of this file')
  // a medium suggestion is never folded
  const medium = { ...entry, card: { ...tableCard, tier: 'medium' as const } }
  expect(folded(medium)).toBe(false)
})

it('disables the Import button until the import has a source', () => {
  const files = [{ ...entry, build: { added: 3, changed: 0 } as BuildView }]
  const foot = (shared: string) =>
    html(
      <ImportFoot
        files={files}
        shared={shared}
        replace={false}
        busy={false}
        onShared={() => {}}
        onReplace={() => {}}
        onImport={() => {}}
      />,
    )
  expect(foot('')).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Import 3 valid rows/)
  expect(foot('Invented catalogue')).not.toMatch(/<button[^>]*disabled=""/)
})

it('sends the data files of a mixed pick to the data import and the rest to the cards', async () => {
  const file = (name: string, text: string) => ({ file: new File([text], name) })
  const picked = [
    file('openreloading-data.json', '﻿  {"format": "openreloading-user-data", "records": []}'),
    file('bullets.csv', 'Name,Diameter\nAlpha,7.82\nBeta,5.70'),
    file('list.json', '[{"Name": "Alpha", "Diameter": 7.82}]'),
  ]
  const { data, tables } = await splitImport(picked)
  expect(data.map((p) => p.file.name)).toEqual(['openreloading-data.json'])
  expect(tables.map((p) => p.file.name)).toEqual(['bullets.csv', 'list.json'])
})
