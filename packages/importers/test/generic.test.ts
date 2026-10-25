import { describe, expect, it } from 'vitest'
import { parseDelimited, parseOpenReloadingCsv } from '../src/index.ts'
import { splitDelimited } from '../src/text.ts'
import { complete } from './complete.ts'
import { template } from './fixtures.ts'

const values = (r: ReturnType<typeof parseDelimited>) =>
  r.session.strings.map((s) => s.shots.map((shot) => shot.velocity.value))

describe('splitDelimited', () => {
  it('keeps empty cells between tabs and reads quoted cells', () => {
    expect(splitDelimited('a\t\tb', '\t')).toEqual(['a', '', 'b'])
    expect(splitDelimited(' "x;y" ;2', ';')).toEqual(['x;y', '2'])
    expect(splitDelimited('a, "b ""c""",')).toEqual(['a', 'b "c"', ''])
  })

  it('keeps text after a closing quote', () => {
    expect(splitDelimited('"a" x,b')).toEqual(['a x', 'b'])
    expect(() =>
      parseDelimited('v,n\n"812" 5,a', { columns: { velocity: 'v' }, velocityUnit: 'm/s' }),
    ).toThrow('row 2: velocity "812 5" is not a number')
  })
})

describe('parseDelimited', () => {
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
    expect(tab.session.strings[0].shots).toEqual([
      { velocity: { value: 812.5, raw: '812.5' }, excluded: 'x' },
      { velocity: { value: 813, raw: '813' } },
    ])
  })

  it('finds the header row by column names and reads quoted cells', () => {
    const text = [
      'Exported by a phone',
      '',
      'No,Speed,Units',
      '1,"2800",fps',
      '2,"857,5",m/s',
    ].join('\n')
    const r = parseDelimited(text, { columns: { velocity: 'speed', velocityUnit: 'UNITS' } })
    expect(r.session.strings[0].shots.map((s) => s.velocity)).toEqual([
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
    expect(r.session.strings[0].shots).toHaveLength(2)
  })

  it('groups consecutive rows by string label and warns when a label returns', () => {
    const r = parseDelimited('A,800\nA,801\nB,810\nA,802', {
      columns: { string: 1, velocity: 2 },
      delimiter: ',',
      velocityUnit: 'm/s',
    })
    expect(values(r)).toEqual([[800, 801], [810], [802]])
    expect(r.stringLabels).toEqual(['A', 'B', 'A'])
    expect(r.warnings).toContain(
      'row 4: string "A" returns after another string; read as a new string',
    )
  })

  it('reads coldBore and excluded values', () => {
    const rows = ['1', 'x', 'YES', 'true', '', '0', 'no', 'False'].map(
      (c, i) => `${800 + i},${c},${c}`,
    )
    const r = parseDelimited(['v,cold,ex', ...rows].join('\n'), {
      columns: { velocity: 'v', coldBore: 'cold', excluded: 'ex' },
      velocityUnit: 'm/s',
    })
    const shots = r.session.strings[0].shots
    expect(shots.map((s) => s.coldBore ?? false)).toEqual([
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
    expect(shots.map((s) => s.excluded)).toEqual([
      '1',
      'x',
      'YES',
      'true',
      undefined,
      undefined,
      undefined,
      undefined,
    ])
    expect(() =>
      parseDelimited('v,cold\n800,maybe', {
        columns: { velocity: 'v', coldBore: 'cold' },
        velocityUnit: 'm/s',
      }),
    ).toThrow(/^row 2: coldBore "maybe"/)
  })

  it('skips a row without a velocity with a warning and throws on other bad cells', () => {
    const r = parseDelimited('A,800\nA,\nA,801', {
      columns: { string: 1, velocity: 2 },
      delimiter: ',',
      velocityUnit: 'm/s',
    })
    expect(values(r)).toEqual([[800, 801]])
    expect(r.warnings).toContain('row 2: no velocity; skipped')
    expect(() =>
      parseDelimited('800\nfast', { columns: { velocity: 1 }, velocityUnit: 'm/s' }),
    ).toThrow('row 2: velocity "fast" is not a number')
    expect(() =>
      parseDelimited('800\n-1', { columns: { velocity: 1 }, velocityUnit: 'm/s' }),
    ).toThrow(/not positive/)
  })

  it('throws on ambiguous commas and uneven rows', () => {
    const opts = { columns: { velocity: 1 }, velocityUnit: 'm/s' } as const
    expect(() => parseDelimited('812,5\n813,0', opts)).toThrow(/name the delimiter/)
    expect(() =>
      parseDelimited('v\n812,5\n813,0', { ...opts, columns: { velocity: 'v' } }),
    ).toThrow('row 2: 2 cells, the header has 1; an unquoted comma inside a cell')
    expect(() => parseDelimited('v\nA,B\n813', { ...opts, columns: { velocity: 'v' } })).toThrow(
      'row 2: 2 cells, the header has 1',
    )
    expect(() => parseDelimited('A,2800\n2810', { ...opts, columns: { velocity: 2 } })).toThrow(
      'row 2: 1 cells, row 1 has 2',
    )
    expect(values(parseDelimited('812,5\n813,0', { ...opts, delimiter: 'none' }))).toEqual([
      [812.5, 813],
    ])
    // a one-column paste with some decimal commas names the remedy, not the cell count
    expect(() => parseDelimited('810\n812,5\n809,8', opts)).toThrow(
      'row 2: "812,5" may be one velocity',
    )
  })

  it('refuses a detected comma that may cut a velocity with decimals or thousands', () => {
    const fps = { columns: { velocity: 1 }, velocityUnit: 'ft/s' } as const
    expect(() => parseDelimited('2,800.0\n2,810.5\n2,795.0\n', fps)).toThrow(
      'row 1: "2,800.0" may be one velocity',
    )
    expect(() => parseDelimited('2,800\n2,810\n2,805.5', fps)).toThrow(/name the delimiter/)
    expect(() =>
      parseDelimited('A,2,800\nA,2,810', { ...fps, columns: { string: 1, velocity: 2 } }),
    ).toThrow('row 1: "2,800" may be one velocity')
    expect(() =>
      parseDelimited('A,812,5\nA,813,0', { ...fps, columns: { string: 1, velocity: 2 } }),
    ).toThrow('row 1: "812,5" may be one velocity')
    const r = parseDelimited('A,2795\nA,2801', { ...fps, columns: { string: 1, velocity: 2 } })
    expect(values(r)).toEqual([[851.916, 853.7448]])
  })

  it('warns once when a detected comma may cut a velocity after a header row', () => {
    const ms = { columns: { velocity: 'velocity' }, velocityUnit: 'm/s' } as const
    const cut = parseDelimited('velocity,note\n812,5\n810,0', ms)
    expect(values(cut)).toEqual([[812, 810]])
    expect(cut.warnings).toContain(
      'rows 2, 3: "812,5" may be a velocity with a decimal comma or a thousands separator split by the delimiter; check the values or name the delimiter',
    )
    expect(cut.warnings.filter((w) => w.includes('may be a velocity'))).toHaveLength(1)
    expect(values(parseDelimited('velocity,note\n812,5', { ...ms, delimiter: ',' }))).toEqual([
      [812],
    ])
    // a shot number before the velocity and a mapped column after it are read without a warning
    const r = parseDelimited('shot,v,cold\n1,812,1', {
      ...ms,
      columns: { velocity: 'v', coldBore: 'cold' },
    })
    expect(r.session.strings[0].shots).toEqual([
      { velocity: { value: 812, raw: '812' }, coldBore: true },
    ])
    expect(r.warnings.some((w) => w.includes('may be a velocity'))).toBe(false)
    const fps = { columns: { velocity: 'velocity' }, velocityUnit: 'ft/s' } as const
    const w = (t: string) => parseDelimited(t, fps).warnings.find((x) => x.includes('may be'))
    expect(w('velocity,note\n2,800')).toMatch(/^row 2: "2,800" may be/)
    // limits: a thousands group after the velocity and a cut before it are not flagged;
    // the plausibility check reports the first (2 ft/s)
    expect(w('velocity,note\n2,800.0')).toBeUndefined()
    expect(
      parseDelimited('velocity,note\n2,800.0', fps).warnings.some((x) =>
        x.includes('outside 30 to 2000 m/s'),
      ),
    ).toBe(true)
    expect(w('Energy,Velocity,Note\n2,600,2800')).toBeUndefined()
    // an unmapped number of 4 or more digits after an integer velocity is a cell
    const e = parseDelimited('Shot,Velocity,Energy\n1,2800,2600\n2,2810,2620', {
      ...fps,
      columns: { velocity: 'Velocity' },
    })
    expect(values(e)).toEqual([[853.44, 856.488]])
    // 1 to 3 digits after an integer velocity are read as a column, with one warning;
    // a named delimiter silences it
    const shots = 'Velocity,Shot\n2800,1\n2810,2'
    expect(values(parseDelimited(shots, fps))).toEqual([[853.44, 856.488]])
    expect(w(shots)).toMatch(/^rows 2, 3: "2800,1" may be/)
    expect(
      parseDelimited(shots, { ...fps, delimiter: ',' }).warnings.some((x) => x.includes('may be')),
    ).toBe(false)
    expect(values(parseDelimited('Shot,Velocity,Energy\n1,1150,450', fps))).toEqual([[350.52]])
  })

  it('warns on velocities outside the plausible range', () => {
    const r = parseDelimited('Shot,Speed\n1,2800\n2,2810\nAVG,2805\nSD,7', {
      columns: { velocity: 'Speed' },
      velocityUnit: 'ft/s',
    })
    expect(r.warnings).toContain(
      'string 1: shots 4 outside 30 to 2000 m/s; check the unit, the column and statistics rows',
    )
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
    expect(() => parseDelimited('Speed\n800', { ...opts, skipRows: -3 })).toThrow(
      /whole number >= 0/,
    )
    expect(() => parseDelimited('Speed\n800', { ...opts, skipRows: 1 })).toThrow(
      /skipRows applies only when every column is a number/,
    )
  })

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
      expect(r.session.strings[0].shots[0].velocity).toEqual({ value, raw: `1000 ${token}` })
      expect(r.warnings).toEqual([])
      expect(r.velocityUnits[0].source).toBe('file')
    }
  })

  it('ignores bracketed header text that is no unit', () => {
    const r = parseDelimited('n,Speed (avg)\n1,800', {
      columns: { velocity: 'Speed (avg)' },
      velocityUnit: 'm/s',
    })
    expect(r.session.strings[0].shots[0].velocity).toEqual({ value: 800, raw: '800' })
    expect(r.warnings.join()).not.toContain('avg')
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
  })

  it('uses the header token when the unit cell is unknown', () => {
    const r = parseDelimited('n,Speed (fps),unit\n1,1000,foo', {
      columns: { velocity: 'Speed (fps)', velocityUnit: 'unit' },
    })
    expect(r.session.strings[0].shots[0].velocity).toEqual({ value: 304.8, raw: '1000 fps' })
  })

  it('uses the caller unit when the velocity header has no token', () => {
    const r = parseDelimited('Muzzle velocity\n812', {
      columns: { velocity: 'muzzle velocity' },
      velocityUnit: 'm/s',
    })
    expect(r.session.strings[0].shots[0].velocity).toEqual({ value: 812, raw: '812' })
    expect(r.velocityUnits).toEqual([{ unit: 'm/s', source: 'caller' }])
    expect(() => parseDelimited('Velocity\n812', { columns: { velocity: 'velocity' } })).toThrow(
      'row 2: velocity unit missing',
    )
  })

  it('takes the token for an empty unit cell and refuses a unit cell that differs', () => {
    const columns = { velocity: 'Speed (fps)', velocityUnit: 'unit' }
    const same = parseDelimited('Speed (fps),unit\n2800,\n2810,FPS', { columns })
    expect(same.session.strings[0].shots.map((s) => s.velocity)).toEqual([
      { value: 853.44, raw: '2800 fps' },
      { value: 856.488, raw: '2810 FPS' },
    ])
    expect(() => parseDelimited('Speed (fps),unit\n2800,\n857,m/s', { columns })).toThrow(
      'row 3: velocityUnit "m/s" differs from "fps" in the velocity header "Speed (fps)"',
    )
  })

  it('throws on an unknown header name, a bad column number or a missing unit', () => {
    expect(() =>
      parseDelimited('a,b\n1,2', { columns: { velocity: 'speed' }, velocityUnit: 'm/s' }),
    ).toThrow('no header row holds "speed"')
    expect(() => parseDelimited('800', { columns: { velocity: 0 }, velocityUnit: 'm/s' })).toThrow(
      /count from 1/,
    )
    expect(() => parseDelimited('800', { columns: { velocity: 1 } })).toThrow(
      /velocity unit missing/,
    )
  })
})

describe('parseOpenReloadingCsv', () => {
  it('names the template remedy when a comma splits a cell', () => {
    expect(() =>
      parseOpenReloadingCsv('velocity,coldBore\n812,5,1', { velocityUnit: 'm/s' }),
    ).toThrow(
      "row 2: 3 cells, the header has 2; an unquoted comma inside a cell (a decimal comma or a thousands separator) splits it: quote the cell or use ';' as the delimiter",
    )
  })

  it('reads the template with labels, cold bore and excluded shots', () => {
    const r = parseOpenReloadingCsv(template, { fileName: 'log.csv' })
    expect(r.format).toBe('openreloading-csv')
    expect(r.stringLabels).toEqual(['42.0 gr', '42.5 gr'])
    expect(r.session.strings[0].shots).toEqual([
      { velocity: { value: 851.916, raw: '2795 fps' }, coldBore: true },
      { velocity: { value: 856.488, raw: '2810 fps' } },
      { velocity: { value: 854.3544, raw: '2803 fps' }, excluded: 'flyer' },
    ])
    expect(complete(r).strings).toHaveLength(2)
  })

  it('reads ";" with decimal commas', () => {
    const r = parseOpenReloadingCsv('velocity;velocityUnit\n812,5;m/s\n813;m/s')
    expect(r.session.strings[0].shots.map((s) => s.velocity.value)).toEqual([812.5, 813])
  })

  it('reads names in any case and ignores a trailing delimiter in the header', () => {
    const r = parseOpenReloadingCsv('String,Velocity,VelocityUnit,ColdBore,\nA,2795,fps,yes,\n')
    expect(r.session.strings[0].shots).toEqual([
      { velocity: { value: 851.916, raw: '2795 fps' }, coldBore: true },
    ])
  })

  it('throws when the first row is not the template header', () => {
    expect(() => parseOpenReloadingCsv('date,velocity\n2026-03-01,800')).toThrow(
      'not an OpenReloading CSV template: the first row must name columns from string, velocity, velocityUnit, coldBore, excluded, velocity among them',
    )
  })
})

describe('caller unit against the file unit', () => {
  const header = { columns: { velocity: 'Speed (fps)' } }

  it('refuses a caller unit that differs from the header token or the template unit cell', () => {
    expect(() => parseDelimited('Speed (fps)\n1000', { ...header, velocityUnit: 'm/s' })).toThrow(
      'row 2: velocity unit "fps" (ft/s) in the file differs from m/s named by the caller',
    )
    expect(() => parseOpenReloadingCsv(template, { velocityUnit: 'm/s' })).toThrow(
      'velocity unit "fps" (ft/s) in the file differs from m/s named by the caller',
    )
  })
})
