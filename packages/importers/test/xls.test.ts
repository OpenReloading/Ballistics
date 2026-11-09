/// <reference types="node" />
import { describe, expect, it } from 'vitest'
import { parseShotViewWorkbook, readWorkbook } from '../src/index.ts'
import { maxCellCharacters, maxCells } from '../src/limits.ts'
import { defined } from './defined.ts'
import { shotViewSheetEnglish, shotViewSheetGerman } from './fixtures.ts'
import { rejection } from './refusal.ts'
import {
  blank,
  bof,
  boolErr,
  compoundFile,
  EOF,
  formula,
  formulaNumber,
  formulaOther,
  type Layout,
  label,
  labelSst,
  mulBlank,
  mulRk,
  numberCell,
  record,
  rkCell,
  rkFloat,
  rkInt,
  sst,
  stringRecord,
  workbookStream,
  xls,
} from './xls.ts'
import { xlsx } from './xlsx.ts'

const sheets = [shotViewSheetEnglish, shotViewSheetGerman]
const rows = [
  ['a', 'b'],
  ['', 'c'],
]

/** One record of each cell type, and the texts the reader gives them. */
const cellRecords = [
  label(0, 0, ' Speed﻿ '),
  label(0, 1, 'Δv'),
  numberCell(0, 2, 2800.5),
  rkCell(0, 3, rkInt(2800)),
  rkCell(0, 4, rkInt(281230, true)),
  rkCell(0, 5, rkInt(35, true)),
  rkCell(0, 6, rkFloat(280050, true)),
  rkCell(0, 7, rkInt(-12)),
  mulRk(0, 8, [rkInt(1), rkInt(2), rkInt(3)]),
  formula(0, 11, formulaNumber(0.5)),
  formula(0, 12, formulaOther(1, 0)),
  formula(0, 13, formulaOther(1, 1)),
  formula(0, 14, formulaOther(2, 0x2a)),
  formula(0, 15, formulaOther(3)),
  formula(0, 16, formulaOther(0)),
  record(0x0221, Buffer.alloc(14)),
  stringRecord(0x0207, Buffer.alloc(0), ' ok '),
  boolErr(0, 17, 1, false),
  boolErr(0, 18, 0, false),
  boolErr(0, 19, 0x07, true),
  blank(0, 20),
  mulBlank(0, 21, 2),
]
const cellRecordTexts = [
  'Speed',
  'Δv',
  '2800.5',
  '2800',
  '2812.3',
  '0.35',
  '2800.5',
  '-12',
  '1',
  '2',
  '3',
  '0.5',
  '',
  '1',
  '#N/A',
  '',
  'ok',
  '1',
  '',
  '#DIV/0!',
  '',
  '',
  '',
]

describe('readWorkbook on .xls: the XLSX twin and sector layouts', () => {
  it('reads the same workbook and session as the XLSX twin', async () => {
    const fromXls = await readWorkbook(xls(sheets))
    const fromXlsx = await readWorkbook(xlsx(sheets))
    expect(fromXls).toEqual(fromXlsx)
    const options = { fileName: 'sessions.xls', sha256: 'c'.repeat(64) }
    const r = parseShotViewWorkbook(fromXls, options)
    expect(r.format).toBe('shotview-xlsx')
    expect(r).toEqual(parseShotViewWorkbook(fromXlsx, options))
  })

  it('reads the stream from FAT sectors, the mini stream, 4096-byte sectors and a DIFAT sector', async () => {
    const padding = record(0x0000, Buffer.alloc(5000))
    const big = [{ name: 'S', rows, records: [padding] }]
    const expected = {
      worksheets: [
        {
          name: 'S',
          rows: [
            ['a', 'b'],
            ['', 'c'],
          ],
        },
      ],
    }
    expect(workbookStream(big).length).toBeGreaterThan(4096)
    expect(workbookStream([{ name: 'S', rows }]).length).toBeLessThan(4096)
    expect(await readWorkbook(xls(big))).toEqual(expected)
    expect(await readWorkbook(xls([{ name: 'S', rows }]))).toEqual(expected)
    expect(await readWorkbook(xls(big, { version: 4 }))).toEqual(expected)
    expect(await readWorkbook(xls([{ name: 'S', rows }], { version: 4 }))).toEqual(expected)
    const difat = xls(big, { fatSectors: 110 })
    expect(new DataView(difat.buffer).getUint32(0x48, true)).toBe(1)
    expect(await readWorkbook(difat)).toEqual(expected)
    // a stream past 109 * 128 sectors: its FAT entries lie in the FAT sector a DIFAT sector lists
    const pad = { name: 'Pad', data: new Uint8Array(109 * 128 * 512) }
    const far = compoundFile([pad, { name: 'Workbook', data: workbookStream(big) }])
    expect(far.readUInt32LE(0x48)).toBe(1)
    expect(await readWorkbook(new Uint8Array(far))).toEqual(expected)
  })
})

describe('readWorkbook on .xls: short sectors, empty texts and cell records', () => {
  it('reads a file whose last sector is short', async () => {
    // [MS-CFB] 2.3 asks the file to reach only the start of its last sector
    const big = [{ name: 'S', rows, records: [record(0x0000, Buffer.alloc(5000))] }]
    const small = [{ name: 'S', rows }]
    for (const version of [3, 4] as const) {
      const S = version === 3 ? 512 : 4096
      for (const sheet of [big, small]) {
        const length = workbookStream(sheet).length
        // bytes used in the last sector: the stream's, or the mini stream's in 64-byte mini sectors
        const used = (length >= 4096 ? length : Math.ceil(length / 64) * 64) % S
        expect(used).toBeGreaterThan(0)
        const file = xls(sheet, { version })
        const cut = file.subarray(0, file.length - S + used)
        expect(await readWorkbook(cut)).toEqual(await readWorkbook(file))
      }
    }
  })

  it('reads empty texts written as LabelSst cells', async () => {
    const book = await readWorkbook(xls(sheets, { empty: true }))
    const twin = await readWorkbook(xlsx(sheets))
    expect(book.worksheets[0]?.rows.flat().length).toBeGreaterThan(
      defined(twin.worksheets[0]).rows.flat().length,
    )
    expect(parseShotViewWorkbook(book)).toEqual(parseShotViewWorkbook(twin))
  })

  it('reads each cell record', async () => {
    const r = await readWorkbook(xls([{ name: 'S', records: cellRecords }]))
    expect(r.worksheets[0]?.rows).toEqual([cellRecordTexts])
  })
})

describe('readWorkbook on .xls: strings across Continue records', () => {
  it('reads strings across Continue records', async () => {
    const long = `${'a'.repeat(30)}Δ${'b'.repeat(10)}`
    const strings = [
      'xxxxxxxxxxxxxxxxxx',
      long,
      { text: 'rich', runs: 3 },
      { text: 'phon', phonetic: 9 },
      { text: 'both', runs: 2, phonetic: 30 },
      'tail',
    ]
    // chunks of 24 bytes: the long string splits inside its characters and switches to two-byte characters and back, the rich string's runs cross a chunk end, and so do the phonetic bytes of the string with runs and phonetic data
    const cells = strings.map((_, k) => labelSst(0, k, k))
    const stream = workbookStream([{ name: 'S', records: cells }], { strings, sstChunk: 24 })
    const r = await readWorkbook(new Uint8Array(compoundFile([{ name: 'Workbook', data: stream }])))
    expect(r.worksheets[0]?.rows).toEqual([['x'.repeat(18), long, 'rich', 'phon', 'both', 'tail']])
    expect(sst(strings, 24).length).toBeGreaterThan(sst(strings).length)
    const continued = [
      formula(0, 0, formulaOther(0)),
      stringRecord(0x0207, Buffer.alloc(0), 'continued string', 8),
    ]
    const s = await readWorkbook(xls([{ name: 'S', records: continued }]))
    expect(s.worksheets[0]?.rows).toEqual([['continued string']])
  })

  it('splits a string right after its header', async () => {
    // SST data: 8 bytes of counts, then a 3-byte header that fills the 11-byte record
    const r = await readWorkbook(
      xls([{ name: 'S', records: [labelSst(0, 0, 0)] }], { strings: ['\u0394bc'], sstChunk: 11 }),
    )
    // the header's flag is 0, the Continue record's flag byte 1
    expect(r.worksheets[0]?.rows).toEqual([['\u0394bc']])
  })
})

describe('readWorkbook on .xls: charts and hidden worksheets', () => {
  it('leaves out embedded charts and chart sheets and reads hidden worksheets', async () => {
    const chart = [
      record(0x005d, Buffer.alloc(4)),
      bof(0x0020),
      numberCell(5, 0, 1),
      record(EOF),
      numberCell(1, 0, 7),
    ]
    const r = await readWorkbook(
      xls([
        { name: 'S', records: chart },
        { name: 'C', type: 2, rows: [['x']] },
        { name: 'H', hidden: 1, rows: [['h']] },
      ]),
    )
    expect(r).toEqual({
      worksheets: [
        { name: 'S', rows: [['7']] },
        { name: 'H', rows: [['h']] },
      ],
    })
  })
})

const fail = (bytes: Uint8Array) => readWorkbook(bytes)
const one = [{ name: 'S', rows, records: [record(0, Buffer.alloc(5000))] }]
/** The one-worksheet file with `patch` applied to its bytes. */
const patched = (patch: (file: Buffer, layout: Layout) => void) => xls(one, { patch })
/** The first sector of the Workbook stream. */
const start = (l: Layout) => l.starts[0] as number
/** A file whose Workbook stream lies in the mini stream, with `patch` applied to its bytes. */
const miniPatched = (patch: (file: Buffer, layout: Layout) => void) =>
  xls([{ name: 'S', rows }], { patch })
/** A file of one worksheet with `records`, read. */
const readCells = (records: Buffer[], strings?: string[]) =>
  fail(xls([{ name: 'S', records }], { strings }))

describe('readWorkbook .xls refusals: compound files', () => {
  it('refuses malformed compound files', async () => {
    const short = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0])
    expect(await rejection(fail(short))).toEqual({ code: 'cfbTooShort', params: {} })
    expect(await rejection(fail(patched((f) => f.writeUInt16LE(0xfeff, 0x1c))))).toEqual({
      code: 'cfbByteOrder',
      params: {},
    })
    expect(await rejection(fail(patched((f) => f.writeUInt16LE(12, 0x1e))))).toEqual({
      code: 'cfbVersion',
      params: { version: 3, shift: 12 },
    })
    expect(
      await rejection(fail(patched((f, l) => f.writeUInt32LE(start(l), l.fatEntry(start(l)))))),
    ).toMatchObject({ code: 'cfbChainLoops' })
    expect(
      await rejection(fail(patched((f, l) => f.writeUInt32LE(0xfffffffe, l.fatEntry(start(l)))))),
    ).toEqual({ code: 'cfbChainEnds', params: {} })
    expect(
      await rejection(fail(patched((f, l) => f.writeUInt32LE(100000, l.fatEntry(start(l)))))),
    ).toEqual({ code: 'cfbSectorOutside', params: { sector: 100000 } })
    expect(await rejection(fail(patched((f, l) => f.writeUInt32LE(1, l.entry(1) + 0x48))))).toEqual(
      { code: 'cfbEntryRepeated', params: { entry: 1 } },
    )
    expect(
      await rejection(fail(patched((f, l) => f.writeUInt32LE(9437184, l.entry(1) + 0x78)))),
    ).toEqual({
      code: 'cfbStreamTooLarge',
      params: { stream: 'Workbook', declared: 9437184, limit: 8388608 },
    })
  })
})

describe('readWorkbook .xls refusals: the mini stream, FAT and directory', () => {
  it('refuses a mini stream layout, FAT, directory or mini stream it cannot follow', async () => {
    expect(await rejection(fail(patched((f) => f.writeUInt16LE(7, 0x20))))).toEqual({
      code: 'cfbMiniLayout',
      params: {},
    })
    expect(await rejection(fail(patched((f) => f.writeUInt32LE(8192, 0x38))))).toEqual({
      code: 'cfbMiniLayout',
      params: {},
    })
    expect(await rejection(fail(patched((f) => f.writeUInt32LE(100000, 0x2c))))).toEqual({
      code: 'cfbFatListed',
      params: { listed: 0, count: 100000 },
    })
    // 237 FAT sectors need two DIFAT sectors; the first one names itself as the next
    const looped = xls(one, {
      fatSectors: 237,
      patch: (f, l) => {
        const d = f.readUInt32LE(0x44)
        f.writeUInt32LE(d, l.offset(d) + l.sectorSize - 4)
      },
    })
    expect(await rejection(fail(looped))).toEqual({ code: 'cfbChainLoops', params: { sector: 0 } })
    const unlisted = xls(one, { fatSectors: 110, patch: (f) => f.writeUInt32LE(0xfffffffe, 0x44) })
    expect(await rejection(fail(unlisted))).toEqual({
      code: 'cfbFatListed',
      params: { listed: 109, count: 110 },
    })
    const beyondFat = compoundFile([{ name: 'Workbook', data: new Uint8Array(70000) }], {
      patch: (f) => f.writeUInt32LE(1, 0x2c),
    })
    expect(await rejection(fail(new Uint8Array(beyondFat)))).toMatchObject({
      code: 'cfbNoFatEntry',
    })
  })
})

describe('readWorkbook .xls refusals: the root entry and the mini stream', () => {
  it('refuses a directory without root entry and a mini stream it cannot follow', async () => {
    expect(
      await rejection(
        fail(
          patched((f, l) => {
            f[l.entry(0) + 0x42] = 1
          }),
        ),
      ),
    ).toEqual({ code: 'cfbNoRoot', params: {} })
    expect(await rejection(fail(miniPatched((f) => f.writeUInt32LE(0xffffffff, 0x3c))))).toEqual({
      code: 'cfbNoMiniStream',
      params: {},
    })
    expect(
      await rejection(fail(miniPatched((f, l) => f.writeUInt32LE(64, l.entry(0) + 0x78)))),
    ).toMatchObject({ code: 'cfbMiniSectorOutside' })
  })
})

describe('readWorkbook .xls refusals: storages and short sectors', () => {
  it('refuses a storage named Workbook and an empty Workbook stream', async () => {
    const storage = xls(one, {
      patch: (f, l) => {
        f[l.entry(1) + 0x42] = 1
      },
    })
    expect(await rejection(fail(storage))).toEqual({ code: 'xlsNoWorkbookStream', params: {} })
    const empty = compoundFile([{ name: 'Workbook', data: new Uint8Array() }])
    expect(await rejection(fail(new Uint8Array(empty)))).toEqual({
      code: 'xlsNotBiff8',
      params: {},
    })
  })

  it('refuses a short last sector that cuts a stream or a directory entry', async () => {
    const file = xls(one)
    expect(await rejection(fail(file.subarray(0, file.length - 511)))).toEqual({
      code: 'cfbStreamPastEnd',
      params: { stream: 'Workbook' },
    })
    const mini = xls([{ name: 'S', rows }])
    expect(await rejection(fail(mini.subarray(0, mini.length - 511)))).toEqual({
      code: 'cfbStreamPastEnd',
      params: { stream: 'Workbook' },
    })
    let entry = 0
    let root = 0
    const cut = xls(one, {
      patch: (_, l) => {
        entry = l.entry(1)
        root = l.entry(0)
      },
    })
    expect(await rejection(fail(cut.subarray(0, entry)))).toEqual({
      code: 'cfbEndsBefore',
      params: { byte: entry + 128 },
    })
    expect(await rejection(fail(cut.subarray(0, root + 0x40)))).toEqual({
      code: 'cfbEndsBefore',
      params: { byte: root + 128 },
    })
  })
})

describe('readWorkbook .xls refusals: missing streams, encryption and BIFF5', () => {
  it('refuses a file without a Workbook stream, an encrypted file and BIFF5', async () => {
    const data = workbookStream([{ name: 'S', rows }])
    expect(await rejection(fail(compoundFile([{ name: 'Other', data }])))).toEqual({
      code: 'xlsNoWorkbookStream',
      params: {},
    })
    expect(await rejection(fail(compoundFile([{ name: 'EncryptedPackage', data }])))).toEqual({
      code: 'xlsEncrypted',
      params: {},
    })
    const biff5 = workbookStream([{ name: 'S', rows }], { bofVersion: 0x0500 })
    expect(await rejection(fail(compoundFile([{ name: 'Book', data: biff5 }])))).toEqual({
      code: 'xlsNotBiff8',
      params: {},
    })
  })
})

describe('readWorkbook .xls refusals: BIFF8 records', () => {
  it('refuses malformed BIFF8 records', async () => {
    expect(await rejection(fail(xls([{ name: 'S', rows }], { filePass: true })))).toEqual({
      code: 'xlsEncrypted',
      params: {},
    })
    const cut = workbookStream([{ name: 'S', rows }])
    expect(
      await rejection(
        fail(compoundFile([{ name: 'Workbook', data: cut.subarray(0, cut.length - 2) }])),
      ),
    ).toMatchObject({ code: 'xlsRecordPastEnd' })
    expect(await rejection(fail(xls([{ name: 'S', rows }], { noSheetEof: true })))).toEqual({
      code: 'xlsWorksheetNoEof',
      params: { sheet: 1 },
    })
    expect(
      await rejection(fail(xls([{ name: 'S', rows }], { positions: (p) => p.map((x) => x + 4) }))),
    ).toEqual({ code: 'xlsWorksheetNoBof', params: { sheet: 1 } })
    expect(
      await rejection(
        fail(
          xls(
            [
              { name: 'A', rows },
              { name: 'B', rows },
            ],
            { positions: (p) => [defined(p[0]), defined(p[0])] },
          ),
        ),
      ),
    ).toEqual({ code: 'xlsWorksheetSameStart', params: { sheet: 2 } })
    // worksheet B starts at the nested BOF inside A, so the padding is read twice
    const nested = [bof(0x0010), record(0, Buffer.alloc(1000)), record(EOF)]
    expect(
      await rejection(
        fail(
          xls([{ name: 'A', records: nested }, { name: 'B' }], {
            positions: (p) => [defined(p[0]), defined(p[0]) + 20],
          }),
        ),
      ),
    ).toEqual({ code: 'xlsSubstreamsOverlap', params: {} })
  })
})

describe('readWorkbook .xls refusals: nested worksheets and root entries', () => {
  it('refuses a worksheet that starts at a BOF nested in another worksheet', async () => {
    const chart = [record(0x005d, Buffer.alloc(4)), bof(0x0010), numberCell(0, 0, 1), record(EOF)]
    expect(
      await rejection(
        fail(
          xls(
            [
              { name: 'A', records: chart },
              { name: 'B', rows: [['b', 'c', 'd', 'e']] },
            ],
            { positions: (p) => [defined(p[0]), defined(p[0]) + 28] },
          ),
        ),
      ),
    ).toEqual({ code: 'xlsSubstreamsOverlap', params: {} })
  })

  it('refuses a root storage with more than 65536 entries', async () => {
    const streams = Array.from({ length: 65537 }, (_, k) => ({
      name: `s${k}`,
      data: new Uint8Array(),
    }))
    expect(await rejection(fail(new Uint8Array(compoundFile(streams))))).toEqual({
      code: 'cfbRootTooLarge',
      params: { max: 65536 },
    })
  })
})

describe('readWorkbook .xls refusals: bad cells', () => {
  it('refuses bad cells as in XLSX', async () => {
    expect(await rejection(readCells([labelSst(0, 0, 5)], ['a', 'b', 'c']))).toEqual({
      code: 'sharedStringOutOfRange',
      params: { cell: 'A1', index: 5, count: 3, worksheet: 1 },
    })
    expect(await rejection(readCells([numberCell(0, 256, 1)]))).toEqual({
      code: 'cellBeyondColumnIV',
      params: { cell: 'IW1', worksheet: 1 },
    })
    expect(await rejection(readCells([numberCell(0, 0, 1), numberCell(0, 0, 2)]))).toEqual({
      code: 'cellOutOfOrder',
      params: { cell: 'A1', worksheet: 1 },
    })
    expect(await rejection(readCells([numberCell(0, 0, Number.POSITIVE_INFINITY)]))).toEqual({
      code: 'xlsNumberNotFinite',
      params: { cell: 'A1', worksheet: 1 },
    })
    expect(
      await rejection(readCells([formula(0, 0, formulaOther(0)), numberCell(0, 1, 1)])),
    ).toEqual({ code: 'xlsFormulaNoString', params: { cell: 'A1', worksheet: 1 } })
    const wrong = mulRk(0, 0, [rkInt(1), rkInt(2)])
    wrong.writeUInt16LE(5, wrong.length - 2)
    expect(await rejection(readCells([wrong]))).toMatchObject({ code: 'xlsCellsMismatch' })
    expect(await rejection(readCells([mulRk(0, 0, [rkInt(1), 0x7ff00000])]))).toEqual({
      code: 'xlsNumberNotFinite',
      params: { cell: 'B1', worksheet: 1 },
    })
    expect(await rejection(readCells([boolErr(0, 0, 0x99, true)]))).toEqual({
      code: 'xlsUnknownErrorCode',
      params: { cell: 'A1', code: 153, worksheet: 1 },
    })
  })
})

describe('readWorkbook .xls refusals: shared strings and cell counts', () => {
  it('refuses a shared string table shorter than its count', async () => {
    const book = workbookStream([{ name: 'S', records: [labelSst(0, 0, 0)] }], {
      strings: ['a', 'b'],
    })
    // cstUnique follows the record header and cstTotal
    book.writeUInt32LE(3, book.indexOf(sst(['a', 'b'])) + 8)
    expect(await rejection(fail(compoundFile([{ name: 'Workbook', data: book }])))).toEqual({
      code: 'xlsSharedStringsEnd',
      params: { read: 2, unique: 3 },
    })
  })

  it('counts cells and cell text over all worksheets', async () => {
    const wide = Array.from({ length: Math.ceil(maxCells / 256) }, (_, r) => numberCell(r, 255, 1))
    expect(await rejection(fail(xls([{ name: 'S', records: wide }])))).toEqual({
      code: 'tooManyCells',
      params: { max: maxCells, worksheet: 1 },
    })
    // a BIFF8 string holds at most 65535 characters (u16 count)
    const big = 'a'.repeat(65535)
    const refs = Array.from({ length: Math.floor(maxCellCharacters / big.length) + 1 }, (_, k) =>
      labelSst(Math.floor(k / 200), k % 200, 0),
    )
    expect(await rejection(fail(xls([{ name: 'S', records: refs }], { strings: [big] })))).toEqual({
      code: 'tooMuchCellText',
      params: { max: maxCellCharacters, worksheet: 1 },
    })
  })
})
