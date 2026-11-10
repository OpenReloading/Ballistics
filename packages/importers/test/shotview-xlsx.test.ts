import { describe, expect, it } from 'vitest'
import {
  detectWorkbookFormat,
  parseShotView,
  parseShotViewWorkbook,
  readWorkbook,
  type Workbook,
  type Worksheet,
} from '../src/index.ts'
import { complete } from './complete.ts'
import { shotViewEnglish, shotViewSheetEnglish, shotViewSheetGerman } from './fixtures.ts'
import { refusal } from './refusal.ts'
import { xlsx } from './xlsx.ts'

const book = (...sheets: Worksheet[]): Workbook => ({ worksheets: sheets })
/** The sheet with the rows for which `test` holds replaced by `rows`. */
const edit = (sheet: Worksheet, test: (cells: string[]) => boolean, rows: string[][]) => {
  const at = sheet.rows.findIndex(test)
  return { ...sheet, rows: [...sheet.rows.slice(0, at), ...rows, ...sheet.rows.slice(at + 1)] }
}
const withDate = (sheet: Worksheet, text: string) =>
  edit(sheet, (c) => c[0] === 'DATE' || c[0] === 'DATUM', [['DATE', text]])

describe('parseShotViewWorkbook: worksheets like the CSV export', () => {
  it('reads one worksheet like the CSV export with the same values', () => {
    // the values of shotViewEnglish: its date and X in COLD BORE (column 8) of shot 1
    const rows = shotViewSheetEnglish.rows.map((c) => (c[0] === '1' ? [...c, '', 'X'] : c))
    const same = withDate({ ...shotViewSheetEnglish, rows }, 'March 3, 2026 at 2:09 PM')
    const options = { fileName: 'sessions.xlsx', sha256: 'b'.repeat(64) }
    const fromBook = parseShotViewWorkbook(book(same), options)
    const fromCsv = parseShotView(shotViewEnglish, options)
    expect(fromBook.session.note).toBe('ShotView bore flags: string 1 shot 1 cold bore')
    const note = fromBook.session.note?.replace('string 1 ', '')
    expect({ ...fromBook, format: fromCsv.format, session: { ...fromBook.session, note } }).toEqual(
      fromCsv,
    )
    const r = parseShotViewWorkbook(book(shotViewSheetEnglish), options)
    expect(r.format).toBe('shotview-xlsx')
    expect(r.session.note).toBeUndefined()
    expect(r.session.date).toBe('2026-03-08')
  })

  it('reads two worksheets in two languages, a bore flag and labels', () => {
    const german = withDate(shotViewSheetGerman, '8. M\u00E4rz 2026 um 09:00')
    const r = parseShotViewWorkbook(book(shotViewSheetEnglish, german))
    expect(r.session.strings.map((s) => s.shots.map((shot) => shot.velocity.value))).toEqual([
      [853.44, 856.6404, 852.0684],
      [850.5, 851.5],
    ])
    expect(r.session.strings[1]?.shots[0]?.velocity.raw).toBe('850.5 mps')
    expect(r.session.strings[1]?.shots[0]?.coldBore).toBe(true)
    expect(r.session.note).toBe('ShotView bore flags: string 2 shot 1 cold bore')
    expect(r.stringLabels).toEqual(['Test load A 42.0gr', 'Load B'])
    expect(r.session.date).toBe('2026-03-08')
    expect(r.warnings).toEqual([])
    expect(complete(r).strings).toHaveLength(2)
  })
})

describe('parseShotViewWorkbook: the footer and worksheets without shots', () => {
  it('ends the shots at the footer', () => {
    const sheet = { ...shotViewSheetEnglish, rows: [...shotViewSheetEnglish.rows, ['5', '2900.0']] }
    expect(parseShotViewWorkbook(book(sheet)).session.strings[0]?.shots).toHaveLength(3)
  })

  it('skips worksheets without a header or shots, and refuses a workbook without shots', () => {
    const noHeader = { name: 'Notes', rows: [['text']] }
    const noShots = { ...shotViewSheetGerman, rows: shotViewSheetGerman.rows.slice(0, 1) }
    const r = parseShotViewWorkbook(book(shotViewSheetEnglish, noHeader, noShots))
    expect(r.session.strings).toHaveLength(1)
    expect(r.warnings).toEqual([
      { code: 'noShotViewHeader', params: { worksheet: 2 } },
      { code: 'footerDateMissing', params: { worksheet: 3 } },
      { code: 'noShotRows', params: { worksheet: 3 } },
    ])
    const noShotsFound = { code: 'noShots', params: {} }
    expect(refusal(() => parseShotViewWorkbook(book(noShots)))).toEqual(noShotsFound)
    expect(refusal(() => parseShotViewWorkbook(book()))).toEqual(noShotsFound)
  })

  it('warns about a missing or unrecognized footer date and footer statistics', () => {
    const noDate = edit(shotViewSheetGerman, (c) => c[0] === 'DATUM', [])
    const r = parseShotViewWorkbook(book(shotViewSheetEnglish, noDate))
    expect(r.session.date).toBeUndefined()
    expect(r.missingPaths).toContain('date')
    expect(r.warnings).toEqual([{ code: 'footerDateMissing', params: { worksheet: 2 } }])
    const odd = withDate(shotViewSheetGerman, 'QUARZ 2026')
    expect(parseShotViewWorkbook(book(odd)).warnings).toEqual([
      { code: 'footerDateUnknown', params: { worksheet: 1, text: 'QUARZ 2026' } },
    ])
    const average = edit(shotViewSheetGerman, (c) => c[0] === 'AVERAGE SPEED', [
      ['AVERAGE SPEED', '855.0'],
    ])
    const w = parseShotViewWorkbook(book(shotViewSheetEnglish, average)).warnings
    expect(w).toEqual([
      {
        code: 'statisticDiffers',
        params: {
          worksheet: 2,
          label: 'AVERAGE SPEED',
          value: '855.0',
          computed: expect.closeTo(851, 1),
        },
      },
    ])
    const sd = edit(shotViewSheetEnglish, (c) => c[0] === 'STD DEV', [['STD DEV', 'n/a']])
    expect(parseShotViewWorkbook(book(sd)).warnings).toEqual([
      { code: 'statisticNotNumber', params: { worksheet: 1, label: 'STD DEV', value: 'n/a' } },
    ])
  })
})

describe('parseShotViewWorkbook: footer labels, empty rows and the date option', () => {
  it('warns about a footer date and a statistics row with the label only', () => {
    const labelOnly = edit(withDate(shotViewSheetEnglish, ''), (c) => c[0] === 'DATE', [['DATE']])
    const spread = edit(labelOnly, (c) => c[0] === 'SPREAD', [['SPREAD']])
    expect(parseShotViewWorkbook(book(spread)).warnings).toEqual([
      { code: 'footerDateUnknown', params: { worksheet: 1, text: '' } },
      { code: 'statisticNotNumber', params: { worksheet: 1, label: 'SPREAD', value: '' } },
    ])
  })

  it('reads empty rows of a caller-built workbook', () => {
    const sheet = { name: 'a', rows: [[], ['#', 'Speed (FPS)'], [], ['1', '2800.0'], []] }
    const r = parseShotViewWorkbook(book(sheet))
    expect(r.session.strings[0]?.shots).toHaveLength(1)
    expect(r.warnings).toEqual([
      { code: 'footerDateMissing', params: { worksheet: 1 } },
      { code: 'footerStatisticsMissing', params: { worksheet: 1 } },
    ])
  })

  it('takes the date option as the date of a workbook without dates', () => {
    const noDate = edit(shotViewSheetGerman, (c) => c[0] === 'DATUM', [])
    const r = parseShotViewWorkbook(book(noDate, noDate), { date: '2026-03-07' })
    expect(r.session.strings).toHaveLength(2)
    expect(r.session.date).toBe('2026-03-07')
    expect(r.warnings).toEqual([])
  })

  it('keeps a worksheet without a date with the date option and warns', () => {
    const dated = withDate(shotViewSheetEnglish, '8. M\u00E4rz 2026 um 09:00')
    const noDate = edit(shotViewSheetGerman, (c) => c[0] === 'DATUM', [])
    const r = parseShotViewWorkbook(book(dated, noDate), { date: '2026-03-08' })
    expect(r.session.strings).toHaveLength(2)
    expect(r.session.date).toBe('2026-03-08')
    expect(r.warnings).toEqual([
      { code: 'dateFromOption', params: { worksheet: 2, date: '2026-03-08' } },
    ])
    expect(
      refusal(() => parseShotViewWorkbook(book(dated, noDate), { date: '2026-03-09' })),
    ).toEqual({ code: 'noStringOnDate', params: { date: '2026-03-09', dates: ['2026-03-08'] } })
  })
})

describe('parseShotViewWorkbook: bore flags, one day and workbook bytes', () => {
  it('notes the bore flags of a shot with its string', () => {
    const flag = (text: string) =>
      edit(shotViewSheetEnglish, (c) => c[0] === '1', [
        ['1', '2800.0', '-2.0', '', '', '2:10 PM', text, text],
      ])
    const set = parseShotViewWorkbook(book(flag('yes')))
    expect(set.session.strings[0]?.shots[0]?.coldBore).toBe(true)
    expect(set.session.note).toBe('ShotView bore flags: string 1 shot 1 clean bore and cold bore')
    const two = edit(flag('yes'), (c) => c[0] === '2', [['2', '2810.5', '', '', '', '', '', 'x']])
    expect(parseShotViewWorkbook(book(two)).session.note).toBe(
      'ShotView bore flags: string 1 shot 1 clean bore and cold bore; string 1 shot 2 cold bore',
    )
  })

  it('keeps one day with the date option', () => {
    const first = withDate(shotViewSheetEnglish, '7. M\u00E4rz 2026 um 10:00')
    const second = withDate(shotViewSheetGerman, '8. M\u00E4rz 2026 um 09:00')
    const all = parseShotViewWorkbook(book(first, second))
    expect(all.session.strings).toHaveLength(2)
    expect(all.session.date).toBeUndefined()
    expect(all.missingPaths).toContain('date')
    expect(all.warnings).toEqual([
      { code: 'severalDays', params: { dates: ['2026-03-07', '2026-03-08'] } },
    ])
    const day = parseShotViewWorkbook(book(first, second), { date: '2026-03-08' })
    expect(day.stringLabels).toEqual(['Load B'])
    expect(day.session.date).toBe('2026-03-08')
    expect(
      refusal(() => parseShotViewWorkbook(book(first, second), { date: '2026-03-09' })),
    ).toEqual({
      code: 'noStringOnDate',
      params: { date: '2026-03-09', dates: ['2026-03-07', '2026-03-08'] },
    })
  })

  it('reads the same session from workbook bytes', async () => {
    const sheets = [shotViewSheetEnglish, shotViewSheetGerman]
    const read = await readWorkbook(xlsx(sheets))
    expect(parseShotViewWorkbook(read)).toEqual(parseShotViewWorkbook(book(...sheets)))
  })
})

describe('detectWorkbookFormat', () => {
  it('tells a header from a long run of brackets in linear time', () => {
    const run = '('.repeat(1_000_000)
    expect(
      detectWorkbookFormat(
        book({
          name: 'a',
          rows: [
            ['#', run],
            ['SHOT #', run],
          ],
        }),
      ),
    ).toBe(null)
  })

  it('detects a ShotView header in any worksheet and nothing else', () => {
    const other = { name: 'Other', rows: [['#', 'Speed']] }
    expect(detectWorkbookFormat(book(other, shotViewSheetEnglish))).toBe('shotview-xlsx')
    expect(detectWorkbookFormat(book(other))).toBeNull()
    expect(detectWorkbookFormat(book())).toBeNull()
  })
})

describe('caller unit against the workbook header unit', () => {
  it('refuses a caller unit that differs from the header unit', () => {
    expect(
      refusal(() => parseShotViewWorkbook(book(shotViewSheetGerman), { velocityUnit: 'ft/s' })),
    ).toEqual({
      code: 'unitDiffersFromCaller',
      params: { text: 'mps', unit: 'm/s', caller: 'ft/s' },
    })
  })
})
