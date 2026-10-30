import { describe, expect, it } from 'vitest'
import { parseShotView } from '../src/index.ts'
import { isShotViewHeader } from '../src/shotview.ts'
import { complete } from './complete.ts'
import { shotViewEnglish, shotViewGerman } from './fixtures.ts'

describe('parseShotView', () => {
  it('reads an English export in fps', () => {
    const r = parseShotView(shotViewEnglish, { fileName: 'session.csv', sha256: 'a'.repeat(64) })
    const shots = r.session.strings[0]?.shots
    expect(shots?.map((s) => s.velocity)).toEqual([
      { value: 853.44, raw: '2800.0 FPS' },
      { value: 856.6404, raw: '2810.5 FPS' },
      { value: 852.0684, raw: '2795.5 FPS' },
    ])
    expect(shots?.map((s) => s.coldBore)).toEqual([true, undefined, undefined])
    expect(r.session.note).toBe('ShotView bore flags: shot 1 cold bore')
    expect(r.session.date).toBe('2026-03-03')
    expect(r.session.device).toEqual({ kind: 'doppler-radar', manufacturerName: 'Garmin' })
    expect(r.session.muzzleDistance).toBeUndefined()
    expect(r.session.provenance).toEqual({
      kind: 'measured',
      sources: [{ title: 'session.csv', sha256: 'a'.repeat(64) }],
    })
    expect(r.stringLabels).toEqual(['Test load A 42.0gr'])
    expect(r.missingPaths).toEqual([
      'id',
      'device.manufacturer',
      'device.model',
      'device.firmware',
      'conditions.airTemperature',
      'strings.0.load',
    ])
    expect(r.warnings).toEqual([])
    expect(complete(r).strings[0]?.shots).toHaveLength(3)
  })

  it('reads 0, no, false and n in a bore flag column as unset, other text as set', () => {
    const flagged = (clean: string, cold: string) =>
      shotViewEnglish.replace(', , X, ', `, ${clean}, ${cold}, `)
    for (const text of ['No', 'FALSE', '0', 'n', ' no ']) {
      const r = parseShotView(flagged(text, text))
      expect(r.session.strings[0]?.shots[0]?.coldBore).toBeUndefined()
      expect(r.session.note).toBeUndefined()
    }
    for (const text of ['x', 'Yes', 'true', '1', '\u2713']) {
      const r = parseShotView(flagged('', text))
      expect(r.session.strings[0]?.shots[0]?.coldBore).toBe(true)
      expect(r.session.note).toBe('ShotView bore flags: shot 1 cold bore')
    }
  })

  it('cuts the commas and the white space after them from the name line', () => {
    const name = (line: string) =>
      parseShotView(shotViewEnglish.replace(/^[^\n]*"Test load A 42.0gr"/, line)).stringLabels
    expect(name('Load A,,,')).toEqual(['Load A'])
    expect(name('Load A, ,')).toEqual(['Load A,'])
    expect(name('Load A,,  ')).toEqual(['Load A'])
    expect(name(`Load A${','.repeat(5000)}x${' '.repeat(5000)}`)).toHaveLength(1)
  })

  it('reads a German export in m/s with decimal commas', () => {
    const r = parseShotView(shotViewGerman)
    const shots = r.session.strings[0]?.shots
    expect(shots?.map((s) => s.velocity)).toEqual([
      { value: 850.5, raw: '850,5 MPS' },
      { value: 848, raw: '848,0 MPS' },
      { value: 848.5, raw: '848,5 MPS' },
    ])
    expect(shots?.[0]?.coldBore).toBe(true)
    expect(r.session.note).toBe('ShotView bore flags: shot 1 clean bore')
    expect(r.session.date).toBe('2026-03-04')
    expect(r.stringLabels).toEqual(['Testladung B, 2,5g P100'])
    expect(r.missingPaths).toContain('provenance.sources.0.title')
    expect(r.warnings).toEqual([])
    expect(r.session.device.manufacturerName).toBe('Garmin')
    expect(complete(r).device.manufacturer).toBe('catalogue:test-maker')
    expect(r.missingPaths).toContain('device.manufacturer')
  })

  it('leaves an unrecognised date to the user', () => {
    const r = parseShotView(shotViewGerman.replace('M\u00C4RZ', 'QUARZ'))
    expect(r.session.date).toBeUndefined()
    expect(r.missingPaths).toContain('date')
    expect(r.warnings).toEqual([
      'footer date "QUARZ 04, 2026 10:00" is not recognised; enter the date',
    ])
    expect(complete(r).date).toBe('2026-03-01')
  })

  it('warns when the footer disagrees with the shots', () => {
    const r = parseShotView(shotViewEnglish.replace('AVERAGE SPEED,2802.0', 'AVERAGE SPEED,2812.0'))
    expect(r.warnings).toEqual([
      'footer AVERAGE SPEED "2812.0" differs from 2802.0 computed from the shots',
    ])
  })

  // spellings seen in exports; KPH, km/h, MPH assumed
  it('reads the unit token of each header spelling', () => {
    const cases: [string, string, number, string, string][] = [
      ['SPEED (FPS)', 'SPEED (FPS)', 853.44, 'FPS', 'ft/s'],
      ['SPEED (FPS)', 'SPEED (KPH)', 777.777778, 'KPH', 'km/h'],
      ['SPEED (FPS)', 'SPEED (km/h)', 777.777778, 'km/h', 'km/h'],
      ['SPEED (FPS)', 'SPEED (MPH)', 1251.712, 'MPH', 'mph'],
    ]
    for (const [from, to, value, token, unit] of cases) {
      const r = parseShotView(shotViewEnglish.replace(from, to))
      expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value, raw: `2800.0 ${token}` })
      expect(r.velocityUnits).toEqual([{ unit, source: 'file' }])
    }
    for (const header of ['Tempo (MPS)', 'TEMPO (MPS)']) {
      const r = parseShotView(shotViewGerman.replace('Tempo (MPS)', header))
      expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value: 850.5, raw: '850,5 MPS' })
      expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'file' }])
    }
  })

  it('refuses an unknown unit unless the caller names it', () => {
    const text = shotViewEnglish.replace('SPEED (FPS)', 'SPEED (KMH)')
    expect(() => parseShotView(text)).toThrow('velocity unit "KMH" is unknown')
    const r = parseShotView(text, { velocityUnit: 'm/s' })
    expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value: 2800, raw: '2800.0 KMH' })
    expect(r.warnings).toContain(
      'velocity unit "KMH" in the file; using m/s as named by the caller',
    )
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
  })

  it('refuses an empty file, a wrong shape and a file without shots', () => {
    expect(() => parseShotView('')).toThrow('not a ShotView CSV')
    expect(() => parseShotView('a,b,c\n1,2,3')).toThrow('not a ShotView CSV')
    expect(() => parseShotView(shotViewEnglish.split('\n').slice(0, 2).join('\n'))).toThrow(
      'no shots found',
    )
  })

  it.each([
    ['not a number', ' "2,810.5",', 'velocity "2,810.5" is not a number'],
    ['a comma that may group thousands', ' "2,810",', 'velocity "2,810" is not a number'],
    ['negative', ' -2810.5,', 'velocity "-2810.5" is not positive'],
  ])('refuses a velocity: %s', (_, cell, message) => {
    expect(() => parseShotView(shotViewEnglish.replace(' 2810.5,', cell))).toThrow(message)
  })

  it('reads no shots after the footer starts and keeps line breaks in quoted notes', () => {
    const shot2 = '8.5, , , 2:10:31 PM, , , ""'
    expect(shotViewEnglish).toContain(shot2)
    const note = shotViewEnglish.replace(shot2, '8.5, , , 2:10:31 PM, , , "wind\n10, 5, gusty"')
    const r = parseShotView(`${note}\n7,1`)
    expect(r.session.strings[0]?.shots.map((s) => s.velocity.raw)).toEqual([
      '2800.0 FPS',
      '2810.5 FPS',
      '2795.5 FPS',
    ])
    expect(r.warnings).toEqual([])
  })

  it('reads a file without a name line or with an unclosed quote at its end', () => {
    const headerFirst = shotViewEnglish.split('\n').slice(1).join('\n')
    const r = parseShotView(headerFirst)
    expect(r.stringLabels).toEqual([undefined])
    expect(r.session.strings[0]?.shots).toHaveLength(3)
    const unclosed = parseShotView(`${shotViewEnglish}\n"open note,\nlast line`)
    expect(unclosed.session.strings[0]?.shots).toHaveLength(3)
    expect(unclosed.warnings).toEqual([])
  })

  it('warns about a footer statistics row with the label only', () => {
    const r = parseShotView(shotViewEnglish.replace('STD DEV,6.3,,,,,,,', 'STD DEV'))
    expect(r.warnings).toEqual(['footer STD DEV "" is not a number; not checked'])
  })

  it('refuses a shot row without a velocity cell', () => {
    const text = shotViewEnglish.replace('-,,,,,,', '4\n-,,,,,,')
    expect(() => parseShotView(text)).toThrow('velocity "" is not a number')
  })

  it('reads lone CR line ends', () => {
    const r = parseShotView(shotViewEnglish.replaceAll('\n', '\r'))
    expect(r.session.strings[0]?.shots).toHaveLength(3)
  })

  it('stores sha256 in lowercase and refuses a malformed one', () => {
    const r = parseShotView(shotViewEnglish, { sha256: 'A'.repeat(64) })
    expect(r.session.provenance.sources[0].sha256).toBe('a'.repeat(64))
    expect(() => parseShotView(shotViewEnglish, { sha256: 'xyz' })).toThrow(
      'sha256 must be 64 hex digits',
    )
  })
})

describe('ShotView CSV rows, name line and footer date', () => {
  const header = shotViewEnglish.split('\n')[1] ?? ''
  const dated = (text: string) =>
    parseShotView(shotViewEnglish.replace(/DATE, "[^"]*"/, `DATE, "${text}"`))

  it('takes a header only with # in its first cell and a bracketed unit in its second', () => {
    expect(isShotViewHeader(['#', 'SPEED (FPS)'])).toBe(true)
    expect(isShotViewHeader(['No', 'SPEED (FPS)'])).toBe(false)
    expect(isShotViewHeader(['#', 'SPEED'])).toBe(false)
    expect(isShotViewHeader(['#'])).toBe(false)
  })

  it('keeps a last shot row whose quoted note is never closed', () => {
    const r = parseShotView(`${header}\n1, 2800.0, , , , , , , "open note`)
    expect(r.session.strings[0]?.shots.map((s) => s.velocity.raw)).toEqual(['2800.0 FPS'])
  })

  it('reads the day after a time and only whole numbers of four digits as the year', () => {
    expect(dated('10:45, 8. M\u00E4rz 2026').session.date).toBe('2026-03-08')
    expect(dated('10:45:37, 8. M\u00E4rz 2026').session.date).toBe('2026-03-08')
    expect(dated('Serie 12345, 8. M\u00E4rz 2026').session.date).toBe('2026-03-08')
  })

  it('leaves a date without a day or without a month to the user', () => {
    for (const text of ['March 2026', '3, 2026']) {
      const r = dated(text)
      expect(r.session.date).toBeUndefined()
      expect(r.warnings).toEqual([`footer date "${text}" is not recognised; enter the date`])
    }
  })

  it('reads the date row after a single dash row and no date after a closing dash row', () => {
    const single = [header, '1, 2800.0', '-,,,', 'DATE, "March 3, 2026"'].join('\n')
    expect(parseShotView(single).session.date).toBe('2026-03-03')
    const r = parseShotView([header, '1, 2800.0', '-,,,'].join('\n'))
    expect(r.session.date).toBeUndefined()
  })

  it('takes the first line with text as the name and reads a quoted name as one cell', () => {
    const named = (line: string) =>
      parseShotView(shotViewEnglish.replace(/^[^\n]*"Test load A 42.0gr"/, line)).stringLabels
    expect(named('   \nLoad A')).toEqual(['Load A'])
    expect(named('"Load A, 42.0gr",,')).toEqual(['Load A, 42.0gr'])
    expect(named(' "Load A, 42.0gr"')).toEqual(['Load A, 42.0gr'])
    const numbers = parseShotView(
      shotViewEnglish.replace(/^[^\n]*"Test load A 42.0gr"/, '308, 175gr'),
    )
    expect(numbers.stringLabels).toEqual(['308, 175gr'])
    expect(numbers.session.strings[0]?.shots).toHaveLength(3)
  })

  it('reads the date row after a blank line below the dash row', () => {
    const r = parseShotView(shotViewEnglish.replace(/\n-,,,,,,\nDATE/, '\n-,,,,,,\n   \nDATE'))
    expect(r.session.date).toBe('2026-03-03')
  })

  it('reads the format and every bore flag of the file', () => {
    const r = parseShotView(shotViewEnglish.replace(/(2:10:31[^,]*), , /, '$1, x, '))
    expect(r.format).toBe('shotview-csv')
    expect(r.session.note).toBe('ShotView bore flags: shot 1 cold bore; shot 2 clean bore')
  })

  it('checks the German labels of the footer statistics', () => {
    const sd = parseShotView(
      shotViewGerman.replace('STANDARDABWEICHUNG,"1,1"', 'STANDARDABWEICHUNG,"9,1"'),
    )
    expect(sd.warnings).toEqual([
      'footer STANDARDABWEICHUNG "9,1" differs from 1.1 computed from the shots',
    ])
    const spread = parseShotView(shotViewGerman.replace('STREUUNG,"2,5"', 'STREUUNG,"9,5"'))
    expect(spread.warnings).toEqual([
      'footer STREUUNG "9,5" differs from 2.5 computed from the shots',
    ])
  })
})

describe('caller unit against the header unit', () => {
  it('refuses a caller unit that differs from the header unit', () => {
    expect(() => parseShotView(shotViewEnglish, { velocityUnit: 'm/s' })).toThrow(
      'velocity unit "FPS" (ft/s) in the file differs from m/s named by the caller',
    )
  })
})
