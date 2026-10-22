import type { UserRecord } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import {
  type LoadFileFormat,
  loadFileFormats,
  parseFiles,
  readLoadFile,
  readNote,
} from '../src/lib/load-file-formats.ts'
import { maxFileBytes, userDataText } from '../src/lib/user-data.ts'

const load: UserRecord = {
  kind: 'workbenchState',
  id: 'w1',
  name: '308 Win.',
  saved: '2026-10-13T10:00:00.000Z',
  data: { siValues: { charge: 0.0028 }, cartridge: '308-win' },
}

/** A made-up format: lines starting `LOAD`, read to one load with two fields not mapped. */
const lines: LoadFileFormat = {
  name: 'Test lines',
  accept: { 'text/plain': ['.txt'] },
  detect: (text) => text.startsWith('LOAD'),
  parse: () => ({
    ok: true,
    records: [load],
    unmapped: ['primer', 'lot'],
    warnings: ['The date is not in the file.'],
  }),
}
const formats = [lines, ...loadFileFormats]

describe('load-file formats', () => {
  it('the OpenReloading user data file is the last entry and reads its files', () => {
    expect(loadFileFormats.at(-1)?.name).toBe('OpenReloading data')
    expect(readLoadFile(userDataText([load]))).toEqual({ ok: true, records: [load] })
  })

  it('the first format that detects the text reads it', () => {
    expect(readLoadFile('LOAD 1', formats)).toEqual(lines.parse('LOAD 1'))
    expect(readLoadFile(userDataText([load]), formats)).toEqual({ ok: true, records: [load] })
  })

  it('text no format claims keeps the reasons of the user data file', () => {
    expect(readLoadFile('{', formats)).toEqual({ ok: false, reason: 'The file is not JSON.' })
    expect(readLoadFile('x'.repeat(maxFileBytes + 1), formats)).toMatchObject({ ok: false })
  })

  it('warnings and fields not mapped reach the import as one note per file', () => {
    expect(readNote(lines.parse(''))).toBe('The date is not in the file. Not read: primer, lot.')
    expect(readNote({ ok: true, records: [] })).toBe('')
    const { records, notes, skipped } = parseFiles(
      [
        { name: 'a.txt', text: 'LOAD 1' },
        { name: 'b.json', text: userDataText([load]) },
        { name: 'c.txt', text: 'other' },
      ],
      formats,
    )
    expect(records).toEqual([load, load])
    expect(notes).toEqual([
      { name: 'a.txt', note: 'The date is not in the file. Not read: primer, lot.' },
    ])
    expect(skipped.map((s) => s.name)).toEqual(['c.txt'])
  })
})
