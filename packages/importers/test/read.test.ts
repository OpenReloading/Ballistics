import { describe, expect, it } from 'vitest'
import {
  decodeText,
  parseChrono,
  parseDelimited,
  parseOpenReloadingCsv,
  parseShotView,
  parseShotViewWorkbook,
  type Workbook,
} from '../src/index.ts'
import { shotViewEnglish, shotViewSheetEnglish, template } from './fixtures.ts'

const utf16le = (s: string) => [...s].flatMap((c) => [c.charCodeAt(0), 0])
const utf16be = (s: string) => [...s].flatMap((c) => [0, c.charCodeAt(0)])
const encoding = /not UTF-8 or UTF-16/
const options = { fileName: 'a.csv', velocityUnit: 'ft/s' as const }

describe('decodeText', () => {
  it('reads UTF-16 LE and BE after a byte order mark', () => {
    expect(decodeText(new Uint8Array([0xff, 0xfe, ...utf16le('v\n')]))).toBe('v\n')
    expect(decodeText(new Uint8Array([0xfe, 0xff, ...utf16be('v\n')]))).toBe('v\n')
  })

  it('reads UTF-8 with and without a byte order mark, keeping U+FEFF for the parsers', () => {
    expect(decodeText(new Uint8Array([0x76, 0x0a, 0xc2, 0xb0]))).toBe('v\n°')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, 0x76, 0x0a]))).toBe('\ufeffv\n')
  })

  it('refuses an odd byte count after a UTF-16 mark and invalid UTF-8 or UTF-16', () => {
    expect(() => decodeText(new Uint8Array([0xff, 0xfe, 0x41]))).toThrow(
      'UTF-16 text with an odd number of bytes',
    )
    expect(() => decodeText(new Uint8Array([0xfe, 0xff, 0x00]))).toThrow(/odd number of bytes/)
    expect(() => decodeText(new Uint8Array([0x41, 0xe9, 0x42]))).toThrow(
      'the file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again',
    )
    // a lone high surrogate, D800, in UTF-16 LE and BE
    expect(() => decodeText(new Uint8Array([0xff, 0xfe, 0x00, 0xd8, 0x41, 0x00]))).toThrow(encoding)
    expect(() => decodeText(new Uint8Array([0xfe, 0xff, 0xd8, 0x00, 0x00, 0x41]))).toThrow(encoding)
  })
})

describe('parseChrono', () => {
  it('dispatches each detected text format to its parser', () => {
    const cases = [
      [shotViewEnglish, parseShotView],
      [template, parseOpenReloadingCsv],
    ] as const
    for (const [text, parse] of cases) {
      const r = parseChrono(text, options)
      expect(r).toEqual(parse(text, options))
      // a UTF-8 byte order mark, which decodeText keeps, does not hide the format
      expect(parseChrono(`\ufeff${text}`, options)?.format).toBe(r?.format)
    }
    expect(cases.map(([text]) => parseChrono(text, options)?.format)).toEqual([
      'shotview-csv',
      'openreloading-csv',
    ])
  })

  it('dispatches each detected workbook format to its parser', () => {
    const shotView: Workbook = { worksheets: [shotViewSheetEnglish] }
    expect(parseChrono(shotView, options)).toEqual(parseShotViewWorkbook(shotView, options))
    expect(parseChrono(shotView, options)?.format).toBe('shotview-xlsx')
  })

  it('returns null when no format is detected', () => {
    expect(parseChrono('2800\n2810', options)).toBeNull()
    expect(parseChrono({ worksheets: [] }, options)).toBeNull()
  })

  it('passes date, device and the column mapping to the formats that take them', () => {
    const date = '2026-03-08'
    const shotView: Workbook = { worksheets: [shotViewSheetEnglish] }
    expect(parseChrono(shotView, { date })).toEqual(parseShotViewWorkbook(shotView, { date }))
    const device = { kind: 'doppler-radar' as const, manufacturerName: 'Manufacturer' }
    expect(parseChrono(template, { device })?.session.device).toEqual(device)
    const r = parseChrono('2800\n2810', { columns: { velocity: 1 }, ...options }, 'delimited')
    expect(r).toEqual(parseDelimited('2800\n2810', { columns: { velocity: 1 }, ...options }))
    expect(() => parseChrono('2800', {}, 'delimited')).toThrow(/needs a column mapping/)
  })

  it('refuses a named format of the other file kind', () => {
    expect(() => parseChrono({ worksheets: [] }, {}, 'shotview-csv')).toThrow(/reads text/)
    expect(() => parseChrono('2800', {}, 'shotview-xlsx')).toThrow(/reads workbooks/)
  })
})
