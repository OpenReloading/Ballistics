import { describe, expect, it } from 'vitest'
import { parseDelimited, parseOpenReloadingCsv } from '../src/index.ts'
import { splitDelimited } from '../src/text.ts'
import { complete } from './complete.ts'
import { template } from './fixtures.ts'
import { refusal } from './refusal.ts'

const values = (r: ReturnType<typeof parseDelimited>) =>
  r.session.strings.map((s) => s.shots.map((shot) => shot.velocity.value))

/** The refusal of a velocity a detected comma may cut, in a file without a header row. */
const commaCut = (row: number, cells: string) => ({
  code: 'commaMayCutVelocity',
  params: { row, cells, remedy: 'nameDelimiter' },
})
const isCommaSplit = (w: { code: string }) => w.code === 'commaMaySplit'

describe('splitDelimited', () => {
  it('keeps empty cells between tabs and reads quoted cells', () => {
    expect(splitDelimited('a\t\tb', '\t')).toEqual(['a', '', 'b'])
    expect(splitDelimited(' "x;y" ;2', ';')).toEqual(['x;y', '2'])
    expect(splitDelimited('a, "b ""c""",')).toEqual(['a', 'b "c"', ''])
  })

  it('keeps text after a closing quote', () => {
    expect(splitDelimited('"a" x,b')).toEqual(['a x', 'b'])
    expect(
      refusal(() =>
        parseDelimited('v,n\n"812" 5,a', { columns: { velocity: 'v' }, velocityUnit: 'm/s' }),
      ),
    ).toEqual({ code: 'velocityNotNumber', params: { cell: '812 5', row: 2 } })
  })
})

describe('parseDelimited: one column, decimal commas and tabs', () => {
  it('reads one column without a header in the named unit', () => {
    const r = parseDelimited('2800\n2810\n\n2795\n', {
      columns: { velocity: 1 },
      velocityUnit: 'ft/s',
    })
    expect(values(r)).toEqual([[853.44, 856.488, 851.916]])
    expect(r.session.device).toEqual({ kind: 'other' })
    expect(r.missingPaths).toEqual([
      'id',
      'date',
      'device.manufacturer',
      'device.model',
      'device.firmware',
      'conditions.airTemperature',
      'strings.0.load',
      'provenance.sources.0.title',
    ])
    expect(complete(r).device).toEqual({
      kind: 'other',
      manufacturer: 'catalogue:test-maker',
      model: 'Model',
      firmware: '1.0',
    })
  })

  it('reads ";" with decimal commas and tab-separated rows', () => {
    const semi = parseDelimited('A;812,5\nA;813,0', {
      columns: { string: 1, velocity: 2 },
      velocityUnit: 'm/s',
    })
    expect(values(semi)).toEqual([[812.5, 813]])
    expect(semi.stringLabels).toEqual(['A'])
    const tab = parseDelimited('812.5\t\tx\n813\t\t', {
      columns: { velocity: 1, excluded: 3 },
      velocityUnit: 'm/s',
    })
    expect(tab.session.strings[0]?.shots).toEqual([
      { velocity: { value: 812.5, raw: '812.5' }, excluded: 'x' },
      { velocity: { value: 813, raw: '813' } },
    ])
  })
})

describe('parseDelimited: the header row, skipped rows and string labels', () => {
  it('finds the header row by column names and reads quoted cells', () => {
    const text = [
      'Exported by a phone',
      '',
      'No,Speed,Units',
      '1,"2800",fps',
      '2,"857,5",m/s',
    ].join('\n')
    const r = parseDelimited(text, { columns: { velocity: 'speed', velocityUnit: 'UNITS' } })
    expect(r.session.strings[0]?.shots.map((s) => s.velocity)).toEqual([
      { value: 853.44, raw: '2800 fps' },
      { value: 857.5, raw: '857,5 m/s' },
    ])
  })

  it('skips rows before the data', () => {
    const r = parseDelimited('title\nmore text\n2800\n2810', {
      columns: { velocity: 1 },
      skipRows: 2,
      velocityUnit: 'ft/s',
    })
    expect(r.session.strings[0]?.shots).toHaveLength(2)
  })

  it('groups consecutive rows by string label and warns when a label returns', () => {
    const r = parseDelimited('A,800\nA,801\nB,810\nA,802', {
      columns: { string: 1, velocity: 2 },
      delimiter: ',',
      velocityUnit: 'm/s',
    })
    expect(values(r)).toEqual([[800, 801], [810], [802]])
    expect(r.stringLabels).toEqual(['A', 'B', 'A'])
    expect(r.warnings).toContainEqual({ code: 'stringReturns', params: { row: 4, label: 'A' } })
  })
})

describe('parseDelimited: cold bore and excluded shots', () => {
  it('reads coldBore and excluded values', () => {
    const rows = ['1', 'x', 'YES', 'true', '', '0', 'no', 'False'].map(
      (c, i) => `${800 + i},${c},${c}`,
    )
    const r = parseDelimited(['v,cold,ex', ...rows].join('\n'), {
      columns: { velocity: 'v', coldBore: 'cold', excluded: 'ex' },
      velocityUnit: 'm/s',
    })
    const shots = r.session.strings[0]?.shots
    expect(shots?.map((s) => s.coldBore ?? false)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
    expect(shots?.map((s) => s.excluded)).toEqual([
      '1',
      'x',
      'YES',
      'true',
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(
      refusal(() =>
        parseDelimited('v,cold\n800,maybe', {
          columns: { velocity: 'v', coldBore: 'cold' },
          velocityUnit: 'm/s',
        }),
      ),
    ).toEqual({
      code: 'coldBoreUnknown',
      params: {
        row: 2,
        text: 'maybe',
        choices: ['1', 'x', 'yes', 'true', '0', 'no', 'false'],
      },
    })
  })
})

describe('parseDelimited: rows it skips or refuses', () => {
  it('skips a row without a velocity with a warning and throws on other bad cells', () => {
    const r = parseDelimited('A,800\nA,\nA,801', {
      columns: { string: 1, velocity: 2 },
      delimiter: ',',
      velocityUnit: 'm/s',
    })
    expect(values(r)).toEqual([[800, 801]])
    expect(r.warnings).toContainEqual({ code: 'noVelocity', params: { row: 2 } })
    expect(
      refusal(() => parseDelimited('800\nfast', { columns: { velocity: 1 }, velocityUnit: 'm/s' })),
    ).toEqual({ code: 'velocityNotNumber', params: { cell: 'fast', row: 2 } })
    expect(
      refusal(() => parseDelimited('800\n-1', { columns: { velocity: 1 }, velocityUnit: 'm/s' })),
    ).toEqual({ code: 'velocityNotPositive', params: { cell: '-1', row: 2 } })
  })

  it.each(['1e999', '-1e999', '9'.repeat(400)])(
    'throws on a velocity that is not a finite number: %s',
    (cell) => {
      expect(
        refusal(() =>
          parseDelimited(`800\n${cell}`, { columns: { velocity: 1 }, velocityUnit: 'm/s' }),
        ),
      ).toEqual({ code: 'velocityNotNumber', params: { cell, row: 2 } })
    },
  )
})

describe('parseDelimited: ambiguous commas and uneven rows', () => {
  it('throws on ambiguous commas and uneven rows', () => {
    const opts = { columns: { velocity: 1 }, velocityUnit: 'm/s' } as const
    const cut = { remedy: 'nameDelimiter' }
    expect(refusal(() => parseDelimited('812,5\n813,0', opts))).toEqual(commaCut(1, '812,5'))
    expect(
      refusal(() => parseDelimited('v\n812,5\n813,0', { ...opts, columns: { velocity: 'v' } })),
    ).toEqual({ code: 'moreCellsThanHeaderComma', params: { row: 2, cells: 2, header: 1, ...cut } })
    expect(
      refusal(() => parseDelimited('v\nA,B\n813', { ...opts, columns: { velocity: 'v' } })),
    ).toEqual({ code: 'moreCellsThanHeaderComma', params: { row: 2, cells: 2, header: 1, ...cut } })
    expect(
      refusal(() => parseDelimited('v\nA;B\n813', { ...opts, columns: { velocity: 'v' } })),
    ).toEqual({ code: 'moreCellsThanHeader', params: { row: 2, cells: 2, header: 1 } })
    expect(
      refusal(() => parseDelimited('A,2800\n2810', { ...opts, columns: { velocity: 2 } })),
    ).toEqual({
      code: 'cellCountDiffers',
      params: { row: 2, cells: 1, firstRow: 1, firstCells: 2 },
    })
    expect(values(parseDelimited('812,5\n813,0', { ...opts, delimiter: 'none' }))).toEqual([
      [812.5, 813],
    ])
    // a one-column paste with some decimal commas names the remedy, not the cell count
    expect(refusal(() => parseDelimited('810\n812,5\n809,8', opts))).toEqual(commaCut(2, '812,5'))
  })
})

describe('parseDelimited: a detected comma that may cut a velocity without a header', () => {
  it('refuses a detected comma that may cut a velocity with decimals or thousands', () => {
    const fps = { columns: { velocity: 1 }, velocityUnit: 'ft/s' } as const
    expect(refusal(() => parseDelimited('2,800.0\n2,810.5\n2,795.0\n', fps))).toEqual(
      commaCut(1, '2,800.0'),
    )
    expect(refusal(() => parseDelimited('2,800\n2,810\n2,805.5', fps))).toEqual(
      commaCut(1, '2,800'),
    )
    expect(
      refusal(() =>
        parseDelimited('A,2,800\nA,2,810', { ...fps, columns: { string: 1, velocity: 2 } }),
      ),
    ).toEqual(commaCut(1, '2,800'))
    expect(
      refusal(() =>
        parseDelimited('A,812,5\nA,813,0', { ...fps, columns: { string: 1, velocity: 2 } }),
      ),
    ).toEqual(commaCut(1, '812,5'))
    const r = parseDelimited('A,2795\nA,2801', { ...fps, columns: { string: 1, velocity: 2 } })
    expect(values(r)).toEqual([[851.916, 853.7448]])
  })
})

describe('parseDelimited: a detected comma that may cut a velocity after a header', () => {
  it('warns once when a detected comma may cut a velocity after a header row', () => {
    const ms = { columns: { velocity: 'velocity' }, velocityUnit: 'm/s' } as const
    const cut = parseDelimited('velocity,note\n812,5\n810,0', ms)
    expect(values(cut)).toEqual([[812, 810]])
    expect(cut.warnings.filter(isCommaSplit)).toEqual([
      {
        code: 'commaMaySplit',
        params: { rows: ['2', '3'], cells: '812,5', remedy: 'nameDelimiter' },
      },
    ])
    expect(values(parseDelimited('velocity,note\n812,5', { ...ms, delimiter: ',' }))).toEqual([
      [812],
    ])
    // a shot number before the velocity and a mapped column after it are read without a warning
    const r = parseDelimited('shot,v,cold\n1,812,1', {
      ...ms,
      columns: { velocity: 'v', coldBore: 'cold' },
    })
    expect(r.session.strings[0]?.shots).toEqual([
      { velocity: { value: 812, raw: '812' }, coldBore: true },
    ])
    expect(r.warnings.some(isCommaSplit)).toBe(false)
    const fps = { columns: { velocity: 'velocity' }, velocityUnit: 'ft/s' } as const
    const w = (t: string) => parseDelimited(t, fps).warnings.find(isCommaSplit)?.params
    expect(w('velocity,note\n2,800')).toMatchObject({ rows: ['2'], cells: '2,800' })
    // limits: a thousands group after the velocity and a cut before it are not flagged; the plausibility check reports the first (2 ft/s)
    expect(w('velocity,note\n2,800.0')).toBeUndefined()
    expect(
      parseDelimited('velocity,note\n2,800.0', fps).warnings.some((x) => x.code === 'outsideRange'),
    ).toBe(true)
    expect(w('Energy,Velocity,Note\n2,600,2800')).toBeUndefined()
    // an unmapped number of 4 or more digits after an integer velocity is a cell
    const e = parseDelimited('Shot,Velocity,Energy\n1,2800,2600\n2,2810,2620', {
      ...fps,
      columns: { velocity: 'Velocity' },
    })
    expect(values(e)).toEqual([[853.44, 856.488]])
    // 1 to 3 digits after an integer velocity are read as a column, with one warning; a named delimiter silences it
    const shots = 'Velocity,Shot\n2800,1\n2810,2'
    expect(values(parseDelimited(shots, fps))).toEqual([[853.44, 856.488]])
    expect(w(shots)).toMatchObject({ rows: ['2', '3'], cells: '2800,1' })
    expect(parseDelimited(shots, { ...fps, delimiter: ',' }).warnings.some(isCommaSplit)).toBe(
      false,
    )
    expect(values(parseDelimited('Shot,Velocity,Energy\n1,1150,450', fps))).toEqual([[350.52]])
  })
})

describe('parseDelimited: warnings, the delimiter and skipped rows', () => {
  it('warns on velocities outside the plausible range', () => {
    const r = parseDelimited('Shot,Speed\n1,2800\n2,2810\nAVG,2805\nSD,7', {
      columns: { velocity: 'Speed' },
      velocityUnit: 'ft/s',
    })
    expect(r.warnings).toContainEqual({
      code: 'outsideRange',
      params: { string: 1, shots: ['4'], min: 30, max: 2000 },
    })
  })

  it('records a unit named by the caller in the provenance note', () => {
    const r = parseDelimited('2800\n2810', { columns: { velocity: 1 }, velocityUnit: 'ft/s' })
    expect(r.session.provenance.sources[0].note).toBe(
      'velocities without a known unit in the file are read as ft/s, as named by the user at import',
    )
    const own = parseDelimited('v,u\n2800,fps', { columns: { velocity: 'v', velocityUnit: 'u' } })
    expect(own.session.provenance.sources[0].note).toBeUndefined()
  })

  it('detects the delimiter outside quotes and from the header row', () => {
    const m = { velocityUnit: 'ft/s' } as const
    const semi = parseDelimited('1,2795,ok\n2,2801,a;b', { ...m, columns: { velocity: 2 } })
    expect(values(semi)).toEqual([[851.916, 853.7448]])
    const pre = parseDelimited('Session; rifle\nSpeed,Unit\n2795,fps', {
      columns: { velocity: 'speed', velocityUnit: 'unit' },
    })
    expect(values(pre)).toEqual([[851.916]])
    const tab = parseDelimited('v,note\n2795,"a\tb"\n2801,', { ...m, columns: { velocity: 'v' } })
    expect(values(tab)).toEqual([[851.916, 853.7448]])
  })

  it('refuses skipRows that is invalid or given with a named column', () => {
    const opts = { columns: { velocity: 'Speed' }, velocityUnit: 'm/s' } as const
    expect(refusal(() => parseDelimited('Speed\n800', { ...opts, skipRows: -3 }))).toEqual({
      code: 'skipRowsNotWhole',
      params: {},
    })
    expect(refusal(() => parseDelimited('Speed\n800', { ...opts, skipRows: 1 }))).toEqual({
      code: 'skipRowsWithHeaderText',
      params: {},
    })
  })
})

describe('parseDelimited: the velocity unit of a header', () => {
  it('reads the unit token of a header-text velocity column', () => {
    const cases: [string, number, string][] = [
      ['Speed (fps)', 304.8, 'fps'],
      ['v fps', 304.8, 'fps'],
      ['Velocity (m/s)', 1000, 'm/s'],
      ['Tempo (MPS)', 1000, 'MPS'],
      ['Speed (kph)', 277.777778, 'kph'],
      ['Speed (mph)', 447.04, 'mph'],
    ]
    for (const [header, value, token] of cases) {
      const r = parseDelimited(`n,${header}\n1,1000`, { columns: { velocity: header } })
      expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value, raw: `1000 ${token}` })
      expect(r.warnings).toEqual([])
      expect(r.velocityUnits[0]?.source).toBe('file')
    }
  })

  it('ignores bracketed header text that is no unit', () => {
    const r = parseDelimited('n,Speed (avg)\n1,800', {
      columns: { velocity: 'Speed (avg)' },
      velocityUnit: 'm/s',
    })
    expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value: 800, raw: '800' })
    expect(r.warnings).toEqual([{ code: 'missingUnitNamedByCaller', params: { unit: 'm/s' } }])
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
  })

  it('uses the header token when the unit cell is unknown', () => {
    const r = parseDelimited('n,Speed (fps),unit\n1,1000,foo', {
      columns: { velocity: 'Speed (fps)', velocityUnit: 'unit' },
    })
    expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value: 304.8, raw: '1000 fps' })
  })

  it('uses the caller unit when the velocity header has no token', () => {
    const r = parseDelimited('Muzzle velocity\n812', {
      columns: { velocity: 'muzzle velocity' },
      velocityUnit: 'm/s',
    })
    expect(r.session.strings[0]?.shots[0]?.velocity).toEqual({ value: 812, raw: '812' })
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
    expect(
      refusal(() => parseDelimited('Velocity\n812', { columns: { velocity: 'velocity' } })),
    ).toEqual({ code: 'missingUnit', params: { row: 2 } })
  })
})

describe('parseDelimited: unit cells and refused columns', () => {
  it('takes the token for an empty unit cell and refuses a unit cell that differs', () => {
    const columns = { velocity: 'Speed (fps)', velocityUnit: 'unit' }
    const same = parseDelimited('Speed (fps),unit\n2800,\n2810,FPS', { columns })
    expect(same.session.strings[0]?.shots.map((s) => s.velocity)).toEqual([
      { value: 853.44, raw: '2800 fps' },
      { value: 856.488, raw: '2810 FPS' },
    ])
    expect(refusal(() => parseDelimited('Speed (fps),unit\n2800,\n857,m/s', { columns }))).toEqual({
      code: 'unitCellDiffersFromHeader',
      params: { cell: 'm/s', token: 'fps', header: 'Speed (fps)', row: 3 },
    })
  })

  it('throws on an unknown header name, a bad column number or a missing unit', () => {
    expect(
      refusal(() =>
        parseDelimited('a,b\n1,2', { columns: { velocity: 'speed' }, velocityUnit: 'm/s' }),
      ),
    ).toEqual({ code: 'noHeaderRow', params: { names: ['speed'] } })
    expect(
      refusal(() => parseDelimited('800', { columns: { velocity: 0 }, velocityUnit: 'm/s' })),
    ).toEqual({ code: 'columnBelowOne', params: { column: 'velocity', number: 0 } })
    expect(refusal(() => parseDelimited('800', { columns: { velocity: 1 } }))).toEqual({
      code: 'missingUnit',
      params: { row: 1 },
    })
  })
})

describe('parseOpenReloadingCsv', () => {
  it('names the template remedy when a comma splits a cell', () => {
    expect(
      refusal(() => parseOpenReloadingCsv('velocity,coldBore\n812,5,1', { velocityUnit: 'm/s' })),
    ).toEqual({
      code: 'moreCellsThanHeaderComma',
      params: { row: 2, cells: 3, header: 2, remedy: 'quoteOrSemicolon' },
    })
  })

  it('reads the template with labels, cold bore and excluded shots', () => {
    const r = parseOpenReloadingCsv(template, { fileName: 'log.csv' })
    expect(r.format).toBe('rangefoundry-csv')
    expect(r.stringLabels).toEqual(['42.0 gr', '42.5 gr'])
    expect(r.session.strings[0]?.shots).toEqual([
      { velocity: { value: 851.916, raw: '2795 fps' }, coldBore: true },
      { velocity: { value: 856.488, raw: '2810 fps' } },
      { velocity: { value: 854.3544, raw: '2803 fps' }, excluded: 'flyer' },
    ])
    expect(complete(r).strings).toHaveLength(2)
  })

  it('reads ";" with decimal commas', () => {
    const r = parseOpenReloadingCsv('velocity;velocityUnit\n812,5;m/s\n813;m/s')
    expect(r.session.strings[0]?.shots.map((s) => s.velocity.value)).toEqual([812.5, 813])
  })

  it('reads names in any case and ignores a trailing delimiter in the header', () => {
    const r = parseOpenReloadingCsv('String,Velocity,VelocityUnit,ColdBore,\nA,2795,fps,yes,\n')
    expect(r.session.strings[0]?.shots).toEqual([
      { velocity: { value: 851.916, raw: '2795 fps' }, coldBore: true },
    ])
  })

  it('throws when the first row is not the template header', () => {
    expect(refusal(() => parseOpenReloadingCsv('date,velocity\n2026-03-01,800'))).toEqual({
      code: 'notTemplate',
      params: { columns: ['string', 'velocity', 'velocityUnit', 'coldBore', 'excluded'] },
    })
  })
})

describe('caller unit against the file unit', () => {
  const header = { columns: { velocity: 'Speed (fps)' } }

  it('refuses a caller unit that differs from the header token or the template unit cell', () => {
    const differs = { text: 'fps', unit: 'ft/s', caller: 'm/s' }
    expect(
      refusal(() => parseDelimited('Speed (fps)\n1000', { ...header, velocityUnit: 'm/s' })),
    ).toEqual({ code: 'unitDiffersFromCaller', params: { ...differs, row: 2 } })
    expect(refusal(() => parseOpenReloadingCsv(template, { velocityUnit: 'm/s' }))).toMatchObject({
      code: 'unitDiffersFromCaller',
      params: differs,
    })
  })
})

describe('parseDelimited: quoted line breaks', () => {
  it('reads a quoted line break as part of its cell and counts rows by their first line', () => {
    const text = 'v,note\n2795,"first\nsecond, still the note"\n2801,"a ""quote"""\n,none'
    const r = parseDelimited(text, { velocityUnit: 'ft/s', columns: { velocity: 'v' } })
    expect(values(r)).toEqual([[851.916, 853.7448]])
    expect(r.warnings).toContainEqual({ code: 'noVelocity', params: { row: 5 } })
    // a quote that never closes joins nothing
    const open = parseDelimited('v,note\n2795,"open\n2801,b', {
      velocityUnit: 'ft/s',
      columns: { velocity: 'v' },
    })
    expect(values(open)).toEqual([[851.916, 853.7448]])
  })

  it('joins no quote of a skipped line into the data rows', () => {
    const text = '"Session 1\n2800,ok\n2810,"note"\n2820,x'
    const r = parseDelimited(text, { columns: { velocity: 1 }, skipRows: 1, velocityUnit: 'm/s' })
    expect(values(r)).toEqual([[2800, 2810, 2820]])
  })
})
