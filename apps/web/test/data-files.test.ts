import 'fake-indexeddb/auto'
import type { UserRecord } from '@open-reloading/schema'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  exportNotes,
  type ImportFile,
  type ImportReport,
  importTexts,
} from '../src/lib/data-files.ts'
import { exportAllText, validRecords } from '../src/lib/user-data.ts'
import { deleteUserDb } from './user-db-reset.ts'

const saved = '2026-10-13T10:00:00.000Z'
const bullet = (id: string, name: string): UserRecord => ({
  kind: 'bullet',
  id,
  name,
  saved,
  data: {
    origin: 'user',
    manufacturer: 'catalogue:example-a',
    overrides: {
      name: '168 gr',
      diameter: { value: 7.82 },
      mass: { value: 10.8862 },
      base: { type: 'boat-tail' },
      ogive: { form: 'tangent' },
    },
  },
})
const a = bullet('9b8a7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d', 'A')
const b = bullet('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d', 'B')
const c = bullet('2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e', 'C')
const bad = { kind: 'bulletDesign', id: 'old-1', name: 'Old', saved, data: 'not an object' }

beforeEach(deleteUserDb)

function file(name: string, records: UserRecord[], raw: unknown[] = []): ImportFile {
  const exported = exportAllText(records, [], validRecords(raw).invalid)
  if (!exported.ok) throw new Error(exported.reason)
  const bytes = new TextEncoder().encode(exported.text)
  return { name, read: async () => bytes }
}

function run(files: ImportFile[], refs = async (_: UserRecord[]) => '') {
  const io = {
    onStored: vi.fn(),
    noteStorage: vi.fn(),
    fail: vi.fn<(said: (tr: typeof english) => string) => void>(),
    show: vi.fn<(report: ImportReport) => void>(),
    refs,
  }
  return { io, done: importTexts(files, io, english) }
}

it('stores two files and reports their records once', async () => {
  const { io, done } = run([file('one.json', [a]), file('two.json', [b], [bad])])
  await done
  expect(io.fail).not.toHaveBeenCalled()
  expect(io.onStored).toHaveBeenCalledOnce()
  const report = io.show.mock.calls[0]?.[0]
  expect(report?.said(english)).toEqual({
    summary: '2 records added, 0 already in this browser, 0 files skipped.',
    invalid: '1 invalid record restored.',
    held: '',
    conflicts: '',
  })
})

it('a read failure on a later file refreshes the lists and states what was stored', async () => {
  const broken: ImportFile = {
    name: 'broken.json',
    read: () => Promise.reject(new Error('disk gone')),
  }
  const { io, done } = run([file('three.json', [c]), broken])
  await done
  expect(io.show).not.toHaveBeenCalled()
  expect(io.onStored).toHaveBeenCalledOnce()
  expect(io.fail.mock.calls[0]?.[0](english)).toBe(
    'Import stored 1 record, then failed on broken.json: disk gone',
  )
})

it('says the conflicts and the invalid records left out in the plural', async () => {
  await run([file('one.json', [a, b], [bad])]).done
  const { io, done } = run([
    file(
      'again.json',
      [
        { ...a, name: 'A2' },
        { ...b, name: 'B2' },
      ],
      [bad, { name: 'no id' }],
    ),
  ])
  await done
  expect(io.show.mock.calls[0]?.[0]?.said(english)).toEqual({
    summary: '0 records added, 0 already in this browser, 0 files skipped.',
    invalid:
      '0 invalid records restored, 1 left out because a browser record has their id, 1 left out without a text id.',
    held: '',
    conflicts:
      '2 records have the id of a browser record with other content: A, B. Replace the browser copies?',
  })
})

it('notes the records that refer to what the browser lacks, once every file is stored', async () => {
  const d = bullet('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', 'D')
  const seen: string[][] = []
  const { io, done } = run([file('d.json', [d])], (added) => {
    seen.push(added.map((r) => r.name))
    return Promise.resolve('D names a missing manufacturer.')
  })
  await done
  expect(seen).toEqual([['D']])
  expect(io.show.mock.calls[0]?.[0]?.notes).toContainEqual({
    name: 'References',
    note: 'D names a missing manufacturer.',
  })
})

it('says a failure before any record without a count to refresh', async () => {
  const broken: ImportFile = { name: 'x.json', read: () => Promise.reject(new Error('gone')) }
  const { io, done } = run([broken])
  await done
  expect(io.onStored).not.toHaveBeenCalled()
  expect(io.fail.mock.calls[0]?.[0](english)).toBe(
    'Import stored 0 records, then failed on x.json: gone',
  )
})

describe('exportNotes', () => {
  const sheet = (name: string, photo?: string) =>
    ({ kind: 'targetSheet', id: name, name, saved, data: { photo } }) as unknown as UserRecord
  const notes = (records: UserRecord[], invalid: number, left: string[]) =>
    exportNotes(
      records,
      validRecords(Array(invalid).fill(bad)).invalid,
      left,
      english.t,
      english.tn,
    )

  it('says nothing for a whole export', () => {
    expect(notes([sheet('S', 'p1'), a], 0, [])).toBe('')
  })

  it('names the sheets whose photos were left out, never another kind', () => {
    expect(notes([sheet('S1', 'p1'), sheet('S2', 'p2'), sheet('S3'), a], 0, ['p1', 'p2'])).toBe(
      'Left out for the file size limit: the photos of S1, S2. Save on a sheet keeps its photo.',
    )
  })

  it('counts the invalid records first, singular and plural', () => {
    expect(notes([], 1, [])).toBe('1 invalid record is in it as stored.')
    expect(notes([sheet('S', 'p')], 2, ['p'])).toBe(
      '2 invalid records are in it as stored. Left out for the file size limit: the photos of S. Save on a sheet keeps its photo.',
    )
  })
})
