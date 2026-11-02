import { describe, expect, it } from 'vitest'
import { shotViewSheetEnglish } from '../../../packages/importers/test/fixtures.ts'
import { xlsx } from '../../../packages/importers/test/xlsx.ts'
import { english } from '../src/i18n/translate.ts'
import {
  chronoFileBytes,
  chronoMessageText,
  exampleCsv,
  exampleSessionFileName,
  formatNames,
  formats,
  readChrono,
  readSession,
  type Shot,
  sessionCsv,
  sessionCsvBlob,
  sessionJsonBlob,
  templateCsv,
  templateJson,
} from '../src/lib/chrono.ts'
import { stringName } from '../src/lib/string-name.ts'
import { stringStats } from '../src/lib/string-stats.ts'
import { unitsOf } from '../src/lib/units.ts'
import { defined } from './defined.ts'

/** The CSV template the page offers, with made-up velocities. */
const template = templateCsv
const fps = 0.3048
const bytes = (s: string) => new TextEncoder().encode(s)
const shot = (value: number, excluded?: string): Shot => ({
  velocity: { value },
  ...(excluded ? { excluded } : {}),
})

describe('readChrono', () => {
  it('tells the template by its header and keeps strings and exclusions', async () => {
    const r = await readChrono(bytes(template), { fileName: 'a.csv' })
    expect(r.format).toBe('openreloading-csv')
    expect(r.stringLabels).toEqual(['A', 'B'])
    expect(r.session.strings.map((s) => s.shots.length)).toEqual([3, 1])
    expect(defined(defined(r.session.strings[0]).shots[2]).excluded).toBe('flyer')
  })

  it('reads UTF-16 LE after a byte order mark', async () => {
    const units = [0xff, 0xfe, ...[...template].flatMap((c) => [c.charCodeAt(0), 0])]
    const r = await readChrono(new Uint8Array(units), {})
    expect(r.session.strings).toHaveLength(2)
  })

  it('rejects files of no known format, naming the formats read and the export to make', async () => {
    const error = await readChrono(bytes('a,b\n1,2'), {}).catch((e: Error) => e)
    const text = chronoMessageText(String((error as Error).message), english.t)
    expect(text).toContain('not a recognized')
    expect(text).toContain('Garmin Xero ShotView CSV')
    expect(text).not.toContain('delimited')
    expect(text).toContain('as CSV or XLSX')
  })

  it('names both units when the file contradicts the velocity unit of the caller', async () => {
    const session = ['string,velocity,velocityUnit', 'A,800,m/s', 'A,810,m/s'].join('\n')
    await expect(
      readChrono(bytes(session), { fileName: 'day1.csv', velocityUnit: 'ft/s' }),
    ).rejects.toThrow(
      /^row 2: velocity unit "m\/s" \(m\/s\) in the file differs from ft\/s named by the caller$/,
    )
  })
})

describe('the file size limit of 32 MiB', () => {
  const limit = 32 * 1024 * 1024
  const file = (size: number) =>
    ({ size, arrayBuffer: async () => new ArrayBuffer(2) }) as unknown as Blob

  it('reads a chosen file up to the limit and refuses a larger one before reading it', async () => {
    expect(await chronoFileBytes(file(limit))).toEqual(new Uint8Array(2))
    await expect(chronoFileBytes(file(limit + 1))).rejects.toThrow(
      'The file is larger than 32 MiB.',
    )
  })

  it('refuses text bytes over the limit, and reads text bytes at the limit', async () => {
    await expect(readChrono(new Uint8Array(limit + 1), {})).rejects.toThrow(
      'The file is larger than 32 MiB.',
    )
    await expect(readChrono(new Uint8Array(limit), {})).rejects.toThrow(/not a recognized/)
  })
})

describe('a workbook', () => {
  it('reads a workbook export', async () => {
    const r = await readChrono(xlsx([shotViewSheetEnglish]), { fileName: 'session.xlsx' })
    expect(r.format).toBe('shotview-xlsx')
  })

  it('is read as a workbook, and one of no known export is named as a workbook', async () => {
    const book = xlsx([
      {
        name: 'Sheet1',
        rows: [
          ['a', 'b'],
          ['1', '2'],
        ],
      },
    ])
    await expect(readChrono(book, {})).rejects.toThrow(/^The workbook is not a recognized/)
  })
})

describe('stringStats', () => {
  it('leaves excluded shots out and uses the n - 1 standard deviation', () => {
    const s = stringStats([shot(2795 * fps), shot(2810 * fps), shot(2803 * fps, 'flyer')])
    expect(s?.count).toBe(2)
    expect(s?.excluded).toBe(1)
    expect(s?.mean).toBeCloseTo(2802.5 * fps, 12)
    expect(s?.standardDeviation).toBeCloseTo((15 / Math.SQRT2) * fps, 12)
    expect(s?.extremeSpread).toBeCloseTo(15 * fps, 12)
  })

  it('has no standard deviation for one shot and no statistics when all are excluded', () => {
    expect(stringStats([shot(800)])?.standardDeviation).toBeUndefined()
    expect(stringStats([shot(800, 'misread')])).toBeUndefined()
  })

  it('carries the SD interval from three shots', () => {
    expect(stringStats([shot(800), shot(802)])?.standardDeviationInterval).toBeUndefined()
    const s = stringStats([shot(800), shot(802), shot(805)])
    expect(s?.confidenceLevel).toBe(0.95)
    expect(s?.standardDeviationInterval?.lower).toBeLessThan(s?.standardDeviation ?? 0)
    expect(s?.standardDeviationInterval?.upper).toBeGreaterThan(s?.standardDeviation ?? 0)
  })

  it('takes a string of 500000 shots', () => {
    const s = stringStats(Array.from({ length: 500_000 }, (_, i) => shot(800 + (i % 7))))
    expect(s?.extremeSpread).toBe(6)
  })
})

it('offers a JSON template and exports a session as JSON that reads back', async () => {
  const read = await readChrono(new TextEncoder().encode(templateJson), { fileName: 't.json' })
  expect(read.format).toBe('openreloading-json')
  expect(read.session.strings.map((s) => s.shots.length)).toEqual([3, 1])
  const back = await readChrono(new Uint8Array(await sessionJsonBlob(read).arrayBuffer()), {
    fileName: 'x.json',
  })
  expect(back.session.strings).toEqual(read.session.strings)
  expect(back.stringLabels).toEqual(['A', 'B'])
  expect(sessionJsonBlob(read).type).toBe('application/json')
})

describe('readSession', () => {
  it('takes the unit of the file over the fallback unit', async () => {
    const r = await readSession(bytes(template), 'a.csv', 'm/s')
    expect(r.velocityUnits).toEqual([{ unit: 'ft/s', source: 'file' }])
  })

  it('uses the fallback unit only when the file names none', async () => {
    const r = await readSession(bytes('string,velocity\nA,812\nA,815'), 'a.csv', 'm/s')
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
    expect(defined(defined(r.session.strings[0]).shots[0]).velocity.value).toBe(812)
  })

  it('keeps the first reason when the file names its unit', async () => {
    const text = 'string,velocity,velocityUnit\nA,812,m/s\nA,0,m/s'
    const first = await readChrono(bytes(text), {}).catch((e: Error) => e.message)
    await expect(readSession(bytes(text), 'a.csv', 'ft/s')).rejects.toThrow(first as string)
  })

  it('names the reason of the read with the fallback unit when the file names no unit', async () => {
    await expect(readSession(bytes('string,velocity\nA,0\nA,815'), 'a.csv', 'm/s')).rejects.toThrow(
      'row 2: velocity "0" is not positive',
    )
  })

  it('keeps the file name as the source of either read', async () => {
    const named = await readSession(bytes(template), 'day1.csv', 'm/s')
    const unnamed = await readSession(bytes('string,velocity\nA,812'), 'day2.csv', 'm/s')
    expect(named.session.provenance.sources[0]?.title).toBe('day1.csv')
    expect(unnamed.session.provenance.sources[0]?.title).toBe('day2.csv')
  })

  it('names the reason when the file is read neither way', async () => {
    await expect(readSession(bytes('a,b\n1,2'), 'a.csv', 'm/s')).rejects.toThrow(/not a recognized/)
  })
})

it('offers an example of three strings of ten made-up shots in the template format', async () => {
  const r = await readSession(bytes(exampleCsv), 'example.csv', 'm/s')
  expect(r.format).toBe('openreloading-csv')
  expect(r.session.strings.map((s) => s.shots.length)).toEqual([10, 10, 10])
  expect(r.stringLabels).toEqual(['Example A', 'Example B', 'Example C'])
  const marked = r.session.strings.map((s) =>
    s.shots.flatMap((shot, k) => [
      ...(shot.coldBore ? [`${k} cold bore`] : []),
      ...(shot.excluded ? [`${k} ${shot.excluded}`] : []),
    ]),
  )
  expect(marked).toEqual([['0 cold bore'], [], ['8 flyer']])
  expect(exampleSessionFileName).toBe('openreloading-example-session.csv')
})

it('names every format read in the browser but the delimited text', () => {
  const { delimited, ...read } = formatNames
  expect(formats).toBe(Object.values(read).join(', '))
  expect(formats).not.toContain(delimited)
})

it('marks the first shot of the JSON template as cold bore', () => {
  const parsed = JSON.parse(templateJson)
  expect(parsed.strings[0].shots[0]).toEqual({ velocity: 852, coldBore: true })
  expect(parsed.device).toEqual({ kind: 'other', manufacturerName: 'Manufacturer', model: 'Model' })
})

it('names a string without a label by its number', () => {
  expect(stringName(['A', undefined], 0, english.t)).toBe('String 1: A')
  expect(stringName(['A', undefined], 1, english.t)).toBe('String 2')
})

describe('sessionCsv', () => {
  it('writes the strings and the shots in the shown velocity unit, labels quoted', async () => {
    const text = [
      'string,velocity,velocityUnit,coldBore,excluded',
      '"A, 41 gr",2795,fps,yes,',
      '"A, 41 gr",2810,fps,,',
      '"A, 41 gr",2803,fps,,"flyer, ""high"""',
      'B,2831,fps,,',
    ].join('\n')
    const r = await readChrono(bytes(text), { fileName: 'a.csv' })
    expect(sessionCsv(r, unitsOf.velocity['ft/s']).split('\n')).toEqual([
      'String,Shots,Excluded,Mean (ft/s),SD (ft/s),ES (ft/s),Min (ft/s),Max (ft/s)',
      '"String 1: A, 41 gr",2,1,2802.5,10.6,15.0,2795.0,2810.0',
      'String 2: B,1,0,2831.0,,0.0,2831.0,2831.0',
      '',
      'String,Shot,Velocity (ft/s),Cold bore,Excluded',
      '"String 1: A, 41 gr",1,2795.0,yes,',
      '"String 1: A, 41 gr",2,2810.0,,',
      '"String 1: A, 41 gr",3,2803.0,,"flyer, ""high"""',
      'String 2: B,1,2831.0,,',
      '',
    ])
    expect(sessionCsv(r, unitsOf.velocity['m/s'])).toContain('String 2: B,1,0,862.9,')
  })

  it('writes a string whose shots are all excluded without statistics', () => {
    const data = {
      stringLabels: [undefined],
      session: { strings: [{ shots: [shot(800, 'flyer'), shot(801, 'flyer')] }] },
    } as unknown as Parameters<typeof sessionCsv>[0]
    expect(sessionCsv(data, unitsOf.velocity['m/s']).split('\n')[1]).toBe('String 1,0,2,,,,,')
  })

  it('keeps text cells from being read as spreadsheet formulas, negative numbers stay numbers', () => {
    const notes = ['=HYPERLINK("x")', '+A1', '-1+2', '@SUM(A1)', '\tx', '\rx']
    const data = {
      stringLabels: ['A'],
      session: { strings: [{ shots: [...notes.map((e) => shot(1, e)), shot(-1)] }] },
    } as unknown as Parameters<typeof sessionCsv>[0]
    const lines = sessionCsv(data, unitsOf.velocity['m/s']).split('\n')
    const shots = lines.slice(lines.indexOf('') + 2)
    expect(shots.slice(0, notes.length + 1)).toEqual([
      `String 1: A,1,1.0,,"'=HYPERLINK(""x"")"`,
      "String 1: A,2,1.0,,'+A1",
      "String 1: A,3,1.0,,'-1+2",
      "String 1: A,4,1.0,,'@SUM(A1)",
      "String 1: A,5,1.0,,'\tx",
      `String 1: A,6,1.0,,"'\rx"`,
      'String 1: A,7,-1.0,,',
    ])
  })
})

describe('sessionCsvBlob', () => {
  it('is UTF-8 CSV with a byte order mark, so spreadsheets read non-ASCII labels', async () => {
    const r = await readChrono(
      bytes('string,velocity,velocityUnit,coldBore,excluded\nÄ µ,2795,fps,,'),
      {
        fileName: 'a.csv',
      },
    )
    const blob = sessionCsvBlob(r, unitsOf.velocity['ft/s'])
    expect(blob.type).toBe('text/csv;charset=utf-8')
    const b = new Uint8Array(await blob.arrayBuffer())
    expect([...b.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(b)).toBe(sessionCsv(r, unitsOf.velocity['ft/s']))
  })
})
