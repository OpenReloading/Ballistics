import { type UserRecord, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { readCsrLoad, readGrtLoad } from '../src/index.ts'
import { defined } from './defined.ts'

const saved = '2026-10-30T00:00:00.000Z'

const field = (name: string, value: string, unit = '') =>
  `<input name="${name}" value="${value}" unit="${unit}" type="decimal" descr="x"/>`

const series = [
  '<Measurement index="2" showinreport="true" title="MEASUREMENTS">',
  '<charge name="Step%20A" showinreport="true" expanded="true" expandedstats="false" note="Cold%20morning" value="0.0021" menu="" menuvalue="" menuunit="m" source="" sourceoptions="%7B%7D">',
  '<shot name="" velocity="701.5" pressure="0"/>',
  '<shot name="" velocity="705.25" pressure="0"/>',
  '</charge>',
  '<charge name="Step%20B" value="0.0022" sourceoptions="%7B%7D">',
  '<shot name="" velocity="719" pressure="2950"/>',
  '</charge>',
  '</Measurement>',
].join('\n')

/** An invented load file of the layout the reader takes: the GRT sections under `load`, a physical section and an appendix. */
function csrFile(o: { format?: string | null; appendix?: string; physical?: string } = {}) {
  const format =
    o.format === undefined ? ' format="1"' : o.format === null ? '' : ` format="${o.format}"`
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<ChamberSimReloaded${format} version="9.9">`,
    '<load>',
    '<title>Testcal%20ladder</title>',
    '<caliber>',
    field('CaliberName', '7.1%20x%2048%20Testcal'),
    field('oal', '70.4', 'mm'),
    field('caselen', '48', 'mm'),
    field('pMaxZul', '4000', 'bar'),
    field('primer', 'LR'),
    field('psadd', '50', 'bar'),
    field('shotshell', 'false'),
    '</caliber>',
    '<caliberfile>\n</caliberfile>',
    '<gun>',
    field('GunName', ''),
    field('twistlen', '250', 'mm'),
    '</gun>',
    '<projectile>',
    field('ProjectileName', 'Inventa%20Arms%2C%20BT%20140'),
    field('mname', 'Inventa%20Arms'),
    field('pname', 'BT%20140'),
    field('Dbul', '7.2', 'mm'),
    field('mp', '9.1', 'g'),
    '</projectile>',
    '<propellant>',
    field('mname', 'Testpowder%20Co'),
    field('pname', 'TP%2020'),
    field('mc', '2.15', 'g'),
    field('Ba', '0.7'),
    '</propellant>',
    o.physical ?? `<physical>${field('physBa', '0.5')}${field('physGrain', 'fitted')}</physical>`,
    `<appendix>${o.appendix ?? `${series}<note index="1" text="Ladder%20day"/>`}</appendix>`,
    '</load>',
    '</ChamberSimReloaded>',
  ].join('\n')
}

const ofKind = <K extends UserRecord['kind']>(records: UserRecord[], kind: K) =>
  defined(records.find((r): r is Extract<UserRecord, { kind: K }> => r.kind === kind))

describe('readCsrLoad', () => {
  it('reads the load, its components and its measurement series, each a valid user record', () => {
    const { records, warnings } = readCsrLoad(csrFile(), saved)
    for (const r of records) expect(userRecord.safeParse(r).success, r.kind).toBe(true)
    expect(records.map((r) => r.kind)).toEqual([
      'cartridge',
      'manufacturer',
      'bullet',
      'powder',
      'load',
      'session',
    ])
    const load = ofKind(records, 'load')
    expect(load.name).toBe('Testcal ladder')
    expect(load.data.charge).toEqual({ value: 2.15 })
    expect(load.data.note).toBe('Ladder day')
    const session = ofKind(records, 'session')
    expect(session.name).toBe('Testcal ladder')
    expect(session.data.device).toEqual({ kind: 'other' })
    expect(session.data.provenance.kind).toBe('measured')
    expect(session.data.strings).toEqual([
      {
        load: `user:${load.id}`,
        label: 'Step A',
        note: 'Cold morning',
        variation: { kind: 'charge', value: { value: 2.1 } },
        shots: [{ velocity: { value: 701.5 } }, { velocity: { value: 705.25 } }],
      },
      {
        load: `user:${load.id}`,
        label: 'Step B',
        variation: { kind: 'charge', value: { value: 2.2 } },
        shots: [{ velocity: { value: 719 } }],
      },
    ])
    expect(warnings).toEqual([])
  })

  it('accounts for every field with a value: read, not read, or warned about', () => {
    const { unmapped } = readCsrLoad(csrFile(), saved)
    expect(unmapped.toSorted((a, b) => a.localeCompare(b))).toEqual(
      [
        'caliber.primer',
        'caliber.psadd',
        'caliberfile',
        'physical',
        'propellant.Ba',
        'appendix.Measurement.index',
        'appendix.Measurement.showinreport',
        'appendix.Measurement.title',
        'appendix.Measurement.charge.showinreport',
        'appendix.Measurement.charge.expanded',
        'appendix.Measurement.charge.expandedstats',
        'appendix.Measurement.charge.menuunit',
        'appendix.Measurement.charge.shot.pressure',
      ].toSorted((a, b) => a.localeCompare(b)),
    )
  })

  it('gives the same ids on a second read', () => {
    const a = readCsrLoad(csrFile(), saved)
    const b = readCsrLoad(csrFile(), '2027-01-01T00:00:00.000Z')
    expect(b.records.map((r) => r.id)).toEqual(a.records.map((r) => r.id))
  })

  it('gives two series of the same content distinct session ids', () => {
    const { records } = readCsrLoad(csrFile({ appendix: series + series }), saved)
    const ids = records.filter((r) => r.kind === 'session').map((r) => r.id)
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps the id of a series when a repeat or another series joins the file', () => {
    const sessionIds = (appendix: string) =>
      readCsrLoad(csrFile({ appendix }), saved)
        .records.filter((r) => r.kind === 'session')
        .map((r) => r.id)
    const [single] = sessionIds(series)
    const other = series.replace('velocity="719"', 'velocity="720"')
    expect(sessionIds(other + series)[1]).toBe(single)
    expect(sessionIds(series + other + series)[0]).toBe(single)
  })

  it('warns on another or a missing format and still reads the load', () => {
    expect(readCsrLoad(csrFile({ format: '2' }), saved).warnings[0]).toMatch(
      /^The file is of format "2"; the reader is written for format 1/,
    )
    const none = readCsrLoad(csrFile({ format: null }), saved)
    expect(none.warnings[0]).toMatch(/^The file is of format unknown/)
    expect(none.records.some((r) => r.kind === 'load')).toBe(true)
  })

  it('skips shots and charges without a velocity and a series without one, with warnings', () => {
    const appendix =
      '<Measurement><charge name="Empty" value="0.002"><shot velocity="0"/></charge>' +
      '<charge name="No%20mass" value=""><shot velocity="650"/><extra/></charge></Measurement>' +
      '<Measurement><charge name="X"/></Measurement>'
    const { records, warnings, unmapped } = readCsrLoad(csrFile({ appendix }), saved)
    const sessions = records.filter((r) => r.kind === 'session')
    expect(sessions).toHaveLength(1)
    expect(ofKind(records, 'session').data.strings).toEqual([
      expect.objectContaining({ label: 'No mass', shots: [{ velocity: { value: 650 } }] }),
    ])
    expect(ofKind(records, 'session').data.strings[0]?.variation).toBeUndefined()
    expect(warnings).toEqual([
      'appendix.Measurement.charge: a shot without a velocity is not read.',
      'appendix.Measurement.charge: the charge Empty holds no shot with a velocity; it is not read.',
      'appendix.Measurement.charge: the charge No mass has no mass; its string varies nothing.',
      'appendix.Measurement.charge: the charge X holds no shot with a velocity; it is not read.',
    ])
    expect(unmapped).toContain('appendix.Measurement.charge.extra')
  })

  it('leaves out the shots of a charge beyond 5000 and the charges of a series beyond 500, with warnings', () => {
    const shots = (n: number) => '<shot velocity="700"/>'.repeat(n)
    const charges = Array.from(
      { length: 502 },
      (_, i) => `<charge name="C${i}" value="0.002">${shots(i === 0 ? 5003 : 2)}</charge>`,
    ).join('')
    const { records, warnings } = readCsrLoad(
      csrFile({ appendix: `<Measurement>${charges}</Measurement>` }),
      saved,
    )
    const strings = ofKind(records, 'session').data.strings
    expect(strings).toHaveLength(500)
    expect(strings[0]?.shots).toHaveLength(5000)
    expect(strings.at(-1)?.label).toBe('C499')
    expect(warnings).toEqual([
      'appendix.Measurement.charge: 3 shots of the charge C0 beyond the limit of 5000 are left out.',
      'appendix.Measurement: 2 charges (4 shots) of the series beyond the limit of 500 are left out.',
    ])
    for (const r of records) expect(userRecord.safeParse(r).success, r.kind).toBe(true)
  })

  it('refuses another root, a file without load and the files of the GRT reader', () => {
    expect(() => readCsrLoad('<other/>', saved)).toThrow('root element')
    expect(() => readCsrLoad('<ChamberSimReloaded format="1"/>', saved)).toThrow('no load')
    expect(() => readGrtLoad(csrFile(), saved)).toThrow('root element')
  })
})
