import { userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  autoMap,
  buildRecords,
  fieldSpecs,
  idOfKey,
  readTable,
  suggestKind,
  type Table,
  type TableKind,
  tableOfRows,
} from '../src/index.ts'
import { defined } from './defined.ts'

const now = '2026-10-28T00:00:00.000Z'
const csv = (rows: string[][], d = ',') => rows.map((r) => r.join(d)).join('\n')
const tableOf = (text: string): Table => {
  const r = readTable(text)
  if ('refusal' in r) throw new Error(r.refusal)
  return r.table
}

const bulletCell = (c: string): string => {
  const rules: [RegExp, string][] = [
    [/name|desc|bullet$|bezeich|product|item/i, 'Invented X'],
    [/maker|hersteller/i, 'Invented Maker'],
    [/cal/i, '.308'],
    [/dia|durch/i, /mm/i.test(c) ? '7.82' : '0.308'],
    [/gr|grain|wt|weight|gewicht|mass/i, /\bg\]|\bg$/.test(c) ? '10.9' : '168'],
    [/len/i, '1.2'],
  ]
  return rules.find(([re]) => re.test(c))?.[1] ?? '0.45'
}
const powderCell = (h: string) =>
  /form|shape|korn/i.test(h)
    ? 'extruded'
    : /base|basis/i.test(h)
      ? 'single'
      : /dens|schuett/i.test(h)
        ? '0.92'
        : /maker/i.test(h)
          ? 'Invented Co'
          : 'Invented P'
const cartridgeCell = (h: string) =>
  /case|l3|huelsen/i.test(h)
    ? '51.2'
    : /coal|overall/i.test(h)
      ? '71.1'
      : /dia|g1|durch/i.test(h)
        ? '7.82'
        : /p/i.test(h) && /bar|pmax|press/i.test(h)
          ? '4150'
          : 'Invented C'
const variant = (kind: TableKind, header: string[], cell: (h: string) => string) => {
  const row = header.map(cell)
  return { kind, header, text: csv([header, row, row, row]) }
}

const variants = [
  ...[
    ['Name', 'Diameter (in)', 'Weight (gr)'],
    ['Description', 'Dia in', 'Grains'],
    ['Bullet', 'Diameter [mm]', 'Mass [g]'],
    ['Bezeichnung', 'Durchmesser mm', 'Gewicht g', 'Hersteller'],
    ['Product', 'Caliber', 'Diameter', 'Wt gr', 'G1'],
    ['Item', 'Maker', 'Dia', 'Weight (gr)', 'Length (in)', 'G7'],
  ].map((h) => variant('bullet', h, bulletCell)),
  ...[
    ['Name', 'Grain form', 'Base'],
    ['Powder', 'Shape', 'Propellant base', 'Bulk density'],
    ['Name', 'Form', 'Basis', 'Schuettdichte g/cm3'],
    ['Item', 'Maker', 'Kornform', 'Base'],
    ['Name', 'Density (g/cm3)', 'Base'],
  ].map((h) => variant('powder', h, powderCell)),
  ...[
    ['Name', 'Case length', 'Bullet diameter', 'Pmax'],
    ['Cartridge', 'L3 (mm)', 'G1 (mm)', 'Max pressure (bar)'],
    ['Name', 'Case length mm', 'COAL mm', 'Pressure bar'],
    ['Bezeichnung', 'Huelsenlaenge', 'Geschossdurchmesser', 'Pmax bar'],
    ['Name', 'Case length', 'Overall length'],
  ].map((h) => variant('cartridge', h, cartridgeCell)),
]

const unrelated = [
  [
    ['Date', 'City', 'Temp'],
    ['2026-01-01', 'A', '3.5'],
    ['2026-01-02', 'B', '4'],
  ],
  [
    ['Id', 'Score', 'Team'],
    ['1', '9.5', 'Red'],
    ['2', '8.0', 'Blue'],
  ],
  [
    ['Name', 'Email', 'Phone'],
    ['A', 'a@example.org', '123'],
    ['B', 'b@example.org', '456'],
  ],
]

describe('suggestKind', () => {
  it.each(variants.map((v) => [v.header.join(', '), v] as const))('%s', (_, v) => {
    const s = suggestKind(tableOf(v.text))
    expect(s.kind).toBe(v.kind)
    expect(s.refusal).toBeUndefined()
  })

  it.each(unrelated.map((rows) => [rows[0]?.join(', '), rows] as const))(
    'refuses %s with the scores and the floor',
    (_, rows) => {
      const s = suggestKind(tableOf(csv(rows)))
      expect(s.kind).toBeUndefined()
      expect(s.refusal).toMatch(
        /^No column matches a bullet, powder or cartridge field \(\w+ \d\.\d\d, \w+ \d\.\d\d, \w+ \d\.\d\d; the floor is 0\.40\)\. Pick the kind by hand/,
      )
    },
  )

  it('gives the tier of the best score', () => {
    expect(suggestKind(tableOf(defined(variants[0]).text)).tier).toBe('high')
    const medium = tableOf(
      csv([
        ['Name', 'Dia', 'Len'],
        ['A', '7.8', '30'],
      ]),
    )
    expect(suggestKind(medium)).toMatchObject({ kind: 'bullet', tier: 'medium' })
  })
})

const bulletOf = (b: ReturnType<typeof buildRecords>, i = 0) => {
  const r = defined(b.entries[i], 'entry').record
  if (r.kind !== 'bullet') throw new Error('not a bullet')
  return { ...r.data, overrides: defined(r.data.overrides ?? undefined, 'overrides') }
}

describe('units and decimal marks', () => {
  it('converts grains, inches and a decimal comma to g and mm within 1e-12', () => {
    const us = tableOf(
      csv([
        ['Name', 'Diameter (in)', 'Weight (gr)'],
        ['T', '0.308', '168'],
      ]),
    )
    const usMap = autoMap(us, 'bullet')
    expect(usMap.map((m) => [m.unit, m.unitFrom])).toEqual([
      [undefined, undefined],
      ['in', 'header'],
      ['gr', 'header'],
    ])
    const a = bulletOf(buildRecords(us, 'bullet', usMap, now)).overrides
    expect(Math.abs((a.mass?.value ?? Number.NaN) - (168 * 64.79891) / 1000)).toBeLessThan(1e-12)
    expect(Math.abs((a.diameter?.value ?? Number.NaN) - 0.308 * 25.4)).toBeLessThan(1e-12)
    expect(a.mass?.raw).toBe('168')

    const eu = tableOf(
      csv(
        [
          ['Name', 'Diameter mm', 'Weight g'],
          ['T', '7,82', '10,89'],
          ['U', '6,72', '9,1'],
        ],
        ';',
      ),
    )
    const euMap = autoMap(eu, 'bullet')
    expect(euMap[1]).toMatchObject({ decimal: ',', unit: 'mm' })
    const b = bulletOf(buildRecords(eu, 'bullet', euMap, now)).overrides
    expect(Math.abs((b.mass?.value ?? Number.NaN) - 10.89)).toBeLessThan(1e-12)
    expect(Math.abs((b.diameter?.value ?? Number.NaN) - 7.82)).toBeLessThan(1e-12)
    expect(b.mass?.raw).toBeUndefined()
  })

  it('guesses the unit from the values when the header names none', () => {
    const t = tableOf(
      csv([
        ['Name', 'Diameter', 'Weight'],
        ['A', '0.308', '168'],
        ['B', '0.224', '77'],
      ]),
    )
    expect(autoMap(t, 'bullet').map((m) => m.unit)).toEqual([undefined, 'in', 'gr'])
    expect(autoMap(t, 'bullet')[1]?.unitFrom).toBe('values')
  })

  it('converts psi, kg/m2 and lb/in2 into bar and lb/in2', () => {
    const t = tableOf(
      csv([
        ['Name', 'Case length', 'Pmax (psi)'],
        ['C', '51.2', '62000'],
        ['D', '57', '60000'],
      ]),
    )
    const r = defined(buildRecords(t, 'cartridge', autoMap(t, 'cartridge'), now).entries[0]).record
    const values = r.kind === 'cartridge' ? r.data.overrides?.values : undefined
    const pmax = values?.find((v) => v.symbol === 'Pmax')
    expect(defined(pmax?.value)).toBeCloseTo(62000 * 0.06894757, 3)
    const bc = defined(fieldSpecs.bullet.find((f) => f.key === 'bcG1')?.units?.[1])
    expect(bc.symbol).toBe('kg/m2')
    expect(bc.toStored(703.0695796391)).toBeCloseTo(1, 9)
  })

  const pmaxOf = (header: string, cells: string[]) => {
    const t = tableOf(
      csv([['Name', 'Case length', header], ...cells.map((c, i) => [`C${i}`, '51', c])]),
    )
    const map = autoMap(t, 'cartridge')
    const built = buildRecords(t, 'cartridge', map, now)
    const r = built.entries[0]?.record
    const pmax =
      r?.kind === 'cartridge'
        ? r.data.overrides?.values?.find((v) => v.symbol === 'Pmax')
        : undefined
    return { map: map[2], built, value: pmax?.value }
  }

  it('reads MPa and kpsi from the header and never guesses them from the values', () => {
    const mpa = pmaxOf('Max pressure (MPa)', ['400', '420'])
    expect(mpa.map).toMatchObject({ unit: 'MPa', unitFrom: 'header' })
    expect(mpa.value).toBeCloseTo(4000, 9)
    const kpsi = pmaxOf('Max pressure (kpsi)', ['62'])
    expect(kpsi.map).toMatchObject({ unit: 'kpsi', unitFrom: 'header' })
    expect(defined(kpsi.value)).toBeCloseTo(62000 * 0.06894757, 3)
    expect(pmaxOf('Max pressure', ['62']).map).toMatchObject({ unit: 'bar', unitFrom: 'default' })
  })

  it('rejects the rows of a column whose header names a unit the field does not take', () => {
    for (const header of ['Max pressure (atm)', 'Max pressure/kPa', 'pmax_atm']) {
      const { map, built } = pmaxOf(header, ['4000', '4100'])
      expect(map, header).toMatchObject({
        field: 'maxPressure',
        unit: undefined,
        unitFrom: 'unknown',
      })
      expect(built.entries).toHaveLength(0)
      expect(built.rejected[0]?.reason).toBe(
        'Max pressure: the header names a unit other than bar, psi, MPa, kpsi. Choose the unit of the column.',
      )
    }
    const t = tableOf(
      csv([
        ['Name', 'Case length', 'Max pressure (atm)'],
        ['C', '51', '4000'],
      ]),
    )
    const map = autoMap(t, 'cartridge').map((m, i) =>
      i === 2 ? { ...m, unit: 'bar', unitFrom: undefined } : m,
    )
    expect(buildRecords(t, 'cartridge', map, now).entries).toHaveLength(1)
  })

  it('reads a unit word after a space and takes another last word as part of the name', () => {
    const t = tableOf(
      csv([
        ['Name', 'Diameter inches', 'Weight grains'],
        ['A', '0.308', '168'],
      ]),
    )
    expect(autoMap(t, 'bullet').map((m) => [m.unit, m.unitFrom])).toEqual([
      [undefined, undefined],
      ['in', 'header'],
      ['gr', 'header'],
    ])
    const c = tableOf(
      csv([
        ['Name', 'Case length', 'Max OAL'],
        ['C', '51.2', '71.1'],
      ]),
    )
    const map = autoMap(c, 'cartridge')
    expect(map.map((m) => m.unitFrom)).toEqual([undefined, 'values', 'values'])
    expect(buildRecords(c, 'cartridge', map, now).rejected).toEqual([])
  })
})

describe('buildRecords', () => {
  const rows = [
    ['Name', 'Maker', 'Diameter (mm)', 'Weight (g)', 'BC G1'],
    ['Good', 'Invented Maker', '7.82', '10.9', '0.45'],
    ['', 'Invented Maker', '7.82', '10.9', ''],
    ['Bad number', '', 'x7', '10.9', ''],
    ['Zero', '', '0', '10.9', ''],
    ['Far', 'Invented Maker', '30', '10.9', ''],
    ['Also good', 'invented  maker', '6.7', '8.4', ''],
  ]
  const table = tableOf(csv(rows))
  const map = autoMap(table, 'bullet')
  const built = buildRecords(table, 'bullet', map, now)

  it('rejects a failing row without blocking the other rows of the file', () => {
    expect(built.counts).toEqual({ accepted: 3, warned: 1, rejected: 3 })
    expect(built.entries.map((e) => e.row)).toEqual([2, 6, 7])
    expect(built.rejected).toEqual([
      {
        row: 3,
        column: 'Name',
        cell: '',
        reason: 'Name is empty. Fill the cell or delete the row.',
      },
      {
        row: 4,
        column: 'Diameter (mm)',
        cell: 'x7',
        reason:
          'Diameter "x7" is not a number with "." as decimal mark. Fix the cell or change the decimal mark of the column.',
      },
      {
        row: 5,
        column: 'Diameter (mm)',
        cell: '0',
        reason: 'Diameter 0 is not above 0. Fix the cell or leave it empty.',
      },
    ])
    expect(built.warnings).toEqual([
      {
        row: 6,
        column: 'Diameter (mm)',
        cell: '30',
        reason: 'Diameter 30 mm is outside the usual 3 to 25 mm. Check the unit of the column.',
      },
    ])
    expect(bulletOf(built).overrides.ballisticCoefficients).toEqual([
      { dragModel: 'G1', value: 0.45 },
    ])
  })

  it('builds records the user record schema accepts', () => {
    expect(built.entries.length + built.makers.length).toBe(4)
    for (const r of [...built.entries, ...built.makers]) userRecord.parse(r.record)
  })

  it('makes one manufacturer record per maker and refers to it', () => {
    expect(built.makers).toHaveLength(1)
    const maker = defined(built.makers[0]).record
    expect(maker).toMatchObject({ kind: 'manufacturer', name: 'Invented Maker' })
    expect(bulletOf(built, 0).manufacturer).toBe(`user:${maker.id}`)
    expect(bulletOf(built, 2).manufacturer).toBe(`user:${maker.id}`)
  })

  it('gives the same ids to the same input read twice, and to a changed value under the same key', () => {
    const again = buildRecords(tableOf(csv(rows)), 'bullet', map, '2026-10-29T00:00:00.000Z')
    expect(again.entries.map((e) => e.record.id)).toEqual(built.entries.map((e) => e.record.id))
    const changed = rows.map((r) => (r[0] === 'Good' ? [...r.slice(0, 4), '0.5'] : r))
    const c = buildRecords(tableOf(csv(changed)), 'bullet', map, now)
    expect(c.entries[0]?.record.id).toBe(built.entries[0]?.record.id)
    expect(bulletOf(c).overrides.ballisticCoefficients).toEqual([{ dragModel: 'G1', value: 0.5 }])
    const otherMass = rows.map((r) => (r[0] === 'Good' ? [r[0], r[1] ?? '', '7.82', '11'] : r))
    const o = buildRecords(tableOf(csv(otherMass)), 'bullet', map, now)
    expect(o.entries[0]?.record.id).not.toBe(built.entries[0]?.record.id)
    expect(defined(built.entries[0]).record.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(idOfKey('a')).toBe(idOfKey('a'))
  })

  it('rejects every row when no column is mapped to a required field', () => {
    const t = tableOf(
      csv([
        ['Name', 'Weight (g)'],
        ['A', '10'],
        ['B', '11'],
      ]),
    )
    const b = buildRecords(t, 'bullet', autoMap(t, 'bullet'), now)
    expect(b.counts).toEqual({ accepted: 0, warned: 0, rejected: 2 })
    expect(b.rejected).toEqual([
      {
        row: 1,
        column: 'Diameter',
        cell: '',
        reason:
          'No column is mapped to Diameter. Map a column to it or read the file as another kind.',
      },
    ])
    const none = buildRecords(t, 'bullet', [{ decimal: '.' }, { decimal: '.' }], now)
    expect(none.rejected[0]?.reason).toBe(
      'No column is mapped to Name, Diameter, Mass. Map a column to each or read the file as another kind.',
    )
  })

  it('rejects a cell that is not a finite number with the not-a-number reason', () => {
    const cells = ['1e999', '-1e999', '9'.repeat(400)]
    const t = tableOf(
      csv([
        ['Name', 'Diameter (mm)', 'Weight (g)'],
        ['A', '7.82', '10.9'],
        ...cells.map((c, i) => [`Big ${i}`, c, '10.9']),
      ]),
    )
    const b = buildRecords(t, 'bullet', autoMap(t, 'bullet'), now)
    expect(b.counts).toEqual({ accepted: 1, warned: 0, rejected: 3 })
    expect(b.rejected.map((r) => [r.cell, r.reason])).toEqual(
      cells.map((c) => [
        c,
        `Diameter "${c}" is not a number with "." as decimal mark. Fix the cell or change the decimal mark of the column.`,
      ]),
    )
  })

  it('reads powders with choices and warns on an unknown spelling', () => {
    const t = tableOf(
      csv([
        ['Name', 'Grain form', 'Base', 'Bulk density'],
        ['P1', 'Spherical', 'double-base', '0.95'],
        ['P2', 'pellet', 'single', ''],
        ['P3', 'constructor', '', ''],
        ['P4', '__proto__', '', ''],
      ]),
    )
    const b = buildRecords(t, 'powder', autoMap(t, 'powder'), now)
    expect(b.counts).toEqual({ accepted: 4, warned: 3, rejected: 0 })
    for (const e of b.entries) userRecord.parse(e.record)
    const [p1, p2] = b.entries.map((e) => e.record)
    expect(p1?.kind === 'powder' && p1.data.draft).toEqual({
      grainForm: 'ball',
      propellantBase: 'double',
      bulkDensity: { value: 0.95 },
    })
    expect(p2?.kind === 'powder' && p2.data.draft).toEqual({ propellantBase: 'single' })
    expect(b.warnings[0]?.reason).toBe(
      'Grain form "pellet" is not one of ball, extruded, flake, other. The value is left out; change the cell to keep it.',
    )
    expect(b.warnings.map((w) => w.cell)).toEqual(['pellet', 'constructor', '__proto__'])
  })

  it('reads cartridges into spec values and numbers rows of a table without a header from 1', () => {
    const read = tableOfRows([['308 Invented', '51.2', '71.1', '0.308', '4150']])
    const t = defined('table' in read ? read.table : undefined, 'table')
    expect(t.hasHeader).toBe(false)
    const map = [
      { field: 'name', decimal: '.' as const },
      { field: 'caseLength', unit: 'mm', decimal: '.' as const },
      { field: 'overallLength', unit: 'mm', decimal: '.' as const },
      { field: 'bulletDiameter', unit: 'in', decimal: '.' as const },
      { field: 'maxPressure', decimal: '.' as const },
    ]
    const b = buildRecords(t, 'cartridge', map, now)
    expect(b.entries[0]?.row).toBe(1)
    const r = userRecord.parse(defined(b.entries[0]).record)
    expect(r.kind === 'cartridge' && r.data.overrides?.values).toEqual([
      { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 51.2 },
      { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 71.1 },
      { side: 'cartridge', symbol: 'G1', quantity: 'length', value: 0.308 * 25.4, raw: '0.308' },
      { symbol: 'Pmax', quantity: 'pressure', value: 4150 },
    ])
  })
})

describe('readTable', () => {
  it('refuses a text with one comma line and no repeated row width as "no table"', () => {
    expect(readTable('Range day, bring the chronograph.\nCheck the new scale.\n')).toEqual({
      refusal:
        'The text has no table: no row repeats a comma, semicolon or tab as separator. Export the table as CSV.',
    })
  })

  it('reads two rows of the same width as a table', () => {
    expect(tableOf('Range day, bring the chronograph.\nCheck, the new scale.\n').rows).toEqual([
      ['Check', 'the new scale.'],
    ])
  })

  it('reads a CSV of 200,000 rows', () => {
    const rows = Array.from({ length: 200_000 }, (_, i) => `${i},168,0.308`)
    const t = tableOf(`Name,Weight,Dia\n${rows.join('\n')}`)
    expect(t.rows).toHaveLength(200_000)
    expect(t.rows.at(-1)).toEqual(['199999', '168', '0.308'])
  })

  it('reads quoted cells across lines, semicolons and tabs', () => {
    const t = tableOf('Name;Note\n"A ""b""";"two\nlines"\nC;d\n')
    expect(t.rows).toEqual([
      ['A "b"', 'two\nlines'],
      ['C', 'd'],
    ])
    expect(tableOf('a\tb\r\n1\t2\r\n').rows).toEqual([['1', '2']])
  })

  it('reads a JSON list of objects and refuses other JSON', () => {
    expect(tableOf('[{"Name":"A","Weight":10},{"Name":"B","Dia":{"x":1},"Weight":null}]')).toEqual({
      header: ['Name', 'Weight', 'Dia'],
      hasHeader: true,
      rows: [
        ['A', '10', ''],
        ['B', '', '{"x":1}'],
      ],
    })
    expect(tableOf('[{"Name":"A"},{"Name":"B","constructor":"x","__proto__":"y"}]').rows).toEqual([
      ['A', '', ''],
      ['B', 'x', 'y'],
    ])
    expect(readTable('[{"a":')).toEqual({
      refusal: 'The text looks like JSON but does not parse. Fix the file or export it again.',
    })
    for (const text of ['{"a":1}', '[1,2]', '[]', '[{"a":1}]'])
      expect(readTable(text)).toHaveProperty(
        'refusal',
        expect.stringMatching(/^The JSON is neither/),
      )
  })

  it('names columns by letter without a header and refuses rows of one column or a header alone', () => {
    const many = tableOfRows([Array.from({ length: 28 }, (_, i) => String(i))])
    expect('table' in many && many.table.header.slice(25)).toEqual([
      'Column Z',
      'Column AA',
      'Column AB',
    ])
    expect(tableOfRows([['a'], ['b']])).toHaveProperty('refusal')
    expect(tableOfRows([['Name', ''], ['A']])).toMatchObject({
      table: { header: ['Name', 'Column B'], rows: [['A', '']] },
    })
    expect(tableOfRows([['Name', 'Weight']])).toEqual({
      refusal: 'The table has a header but no rows. Add rows or choose another file.',
    })
  })

  it('follows spreadsheet letters past column Z', () => {
    const wide = tableOfRows([Array.from({ length: 256 }, (_, i) => String(i))])
    const header = 'table' in wide ? wide.table.header : []
    expect([25, 26, 51, 52, 255].map((i) => header[i])).toEqual([
      'Column Z',
      'Column AA',
      'Column AZ',
      'Column BA',
      'Column IV',
    ])
  })

  it('refuses delimited text and JSON lists beyond the column and cell limits quickly', () => {
    const started = performance.now()
    expect(readTable(`a,b\n1,2\n5${','.repeat(1_000_000)}\n3,4\n`)).toEqual({
      refusal:
        'The table has more than 256 columns. Remove the extra columns or choose another file.',
    })
    const objects = Array.from({ length: 2000 }, (_, i) => ({ [`k${i % 1000}`]: i }))
    expect(readTable(JSON.stringify(objects))).toEqual({
      refusal:
        'The table has more than 256 columns. Remove the extra columns or choose another file.',
    })
    const tall = Array.from({ length: 500_001 }, () => ['1', '2'])
    expect(tableOfRows(tall)).toEqual({
      refusal: 'The table has more than 1000000 cells. Split it into smaller files.',
    })
    expect(readTable(`a,b\n1,2\n${','.repeat(257)}x`)).toEqual({
      refusal:
        'The table has more than 256 columns. Remove the extra columns or choose another file.',
    })
    expect(readTable('1,2\n'.repeat(5_000_000))).toEqual({
      refusal: 'The table has more than 1000000 cells. Split it into smaller files.',
    })
    expect(performance.now() - started).toBeLessThan(5000)
  })
})
