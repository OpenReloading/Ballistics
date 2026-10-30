import type { UserRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  type LoadFileFormat,
  loadFileFormats,
  parseFiles,
  readLoadFile,
  readNote,
} from '../src/lib/load-file-formats.ts'
import { maxFileBytes, userDataText } from '../src/lib/user-data.ts'

const load: UserRecord = {
  kind: 'load',
  id: 'w1',
  name: '308 Win.',
  saved: '2026-10-13T10:00:00.000Z',
  data: { origin: 'user', charge: { value: 2.8 }, cartridge: 'catalogue:308-win' },
}

const bytes = (text: string) => new TextEncoder().encode(text)

/** A made-up format: lines starting `LOAD`, read to one load with two fields not mapped. */
const lines: LoadFileFormat = {
  name: 'Test lines',
  accept: { 'text/plain': ['.txt'] },
  detect: (b) => new TextDecoder().decode(b).startsWith('LOAD'),
  parse: () => ({
    ok: true,
    records: [load],
    unmapped: ['primer', 'lot'],
    warnings: ['The date is not in the file.'],
  }),
}
const formats = [...loadFileFormats, lines]

describe('load-file formats', () => {
  it('the OpenReloading user data file is the first entry and reads its files', async () => {
    expect(loadFileFormats[0]?.name).toBe('OpenReloading data')
    expect(await readLoadFile(bytes(userDataText([load])))).toEqual({ ok: true, records: [load] })
  })

  it('the first format that detects the bytes reads them', async () => {
    expect(await readLoadFile(bytes('LOAD 1'), formats)).toEqual(await lines.parse(bytes('LOAD 1')))
    expect(await readLoadFile(bytes(userDataText([load])), formats)).toEqual({
      ok: true,
      records: [load],
    })
  })

  it('text no format claims keeps the reasons of the user data file', async () => {
    expect(await readLoadFile(bytes('{'), formats)).toEqual({
      ok: false,
      reason: 'The file is not JSON.',
    })
    expect(await readLoadFile(new Uint8Array(maxFileBytes + 1), formats)).toMatchObject({
      ok: false,
    })
  })

  it('warnings and fields not mapped reach the import as one note per file', async () => {
    expect(readNote(await lines.parse(bytes('')), english.t)).toBe(
      'The date is not in the file. Not read: primer, lot.',
    )
    expect(readNote({ ok: true, records: [] }, english.t)).toBe('')
    const { records, notes, skipped } = await parseFiles(
      [
        { name: 'a.txt', bytes: bytes('LOAD 1') },
        { name: 'b.json', bytes: bytes(userDataText([load])) },
        { name: 'c.txt', bytes: bytes('other') },
      ],
      formats,
      english.t,
    )
    expect(records).toEqual([load, load])
    expect(notes).toEqual([
      { name: 'a.txt', note: 'The date is not in the file. Not read: primer, lot.' },
    ])
    expect(skipped.map((s) => s.name)).toEqual(['c.txt'])
  })
})
