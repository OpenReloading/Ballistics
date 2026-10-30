import { type UserRecord, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { readGrtLoad } from '../src/index.ts'
import { defined } from './defined.ts'

const saved = '2026-10-30T00:00:00.000Z'

type Field = [name: string, value: string, unit?: string]

/** An invented load file of the layout the reader takes: sections of `input` fields and an appendix. */
function grtFile(o: {
  title?: string
  sections?: Record<string, Field[]>
  extra?: string
  appendix?: string
  eol?: string
}) {
  const sections: Record<string, Field[]> = o.sections ?? {
    caliber: [
      ['CaliberName', '9.1%20x%2040%20Testcal'],
      ['oal', '58.2', 'mm'],
      ['caselen', '40', 'mm'],
      ['Dz', '9.3', 'mm'],
      ['Aeff', '66.5', 'mm2'],
      ['pMaxZul', '3600', 'bar'],
      ['ps', '200', 'bar'],
      ['sebert', '0.4'],
      ['shotshell', 'false'],
      ['casevol', '2.9', 'cm3'],
    ],
    gun: [
      ['GunName', ''],
      ['xe', '500', 'mm'],
      ['twistlen', '300', 'mm'],
      ['mgun', '4.2', 'kg'],
    ],
    projectile: [
      ['ProjectileName', 'Inventa%20Arms%2C%20RN%20120'],
      ['mname', 'Inventa%20Arms'],
      ['pname', 'RN%20120'],
      ['Dbul', '9.3', 'mm'],
      ['mp', '7.8', 'g'],
      ['glen', '16.1', 'mm'],
      ['g1bc', '0.21'],
      ['g7bc', '0'],
      ['gTailType', '1'],
    ],
    propellant: [
      ['mname', 'Testpowder%20Co'],
      ['pname', 'TP%2010'],
      ['lotid', 'L-77'],
      ['k', '1.23'],
      ['pc', '1600', 'kg/m3'],
      ['pcd', '950', 'kg/m3'],
      ['pt', '20', 'Cel'],
      ['mc', '0.45', 'g'],
      ['Ba', '0.9'],
      ['eta', '1', 'cm3/kg'],
    ],
  }
  const eol = o.eol ?? '\n'
  const body = Object.entries(sections).map(
    ([name, fields]) =>
      `<${name}>${eol}${fields
        .map(
          ([n, v, u = '']) =>
            `<input name='${n}' value='${v}' unit='${u}' type='decimal' descr='x' />`,
        )
        .join(eol)}${eol}</${name}>`,
  )
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>',
    "<GordonsReloadingTool version='1.0'>",
    '<InnerBallistikInput>',
    `<title>${o.title ?? 'Testcal%20load'}</title>`,
    '<config name="CurveFocusIdx" value="0" unit="" type="integer" descr="" />',
    ...body,
    o.extra ?? '',
    `<appendix>${o.appendix ?? '<note index="1" text="First%20try" />'}</appendix>`,
    '</InnerBallistikInput>',
    '</GordonsReloadingTool>',
  ].join(eol)
}

const ofKind = <K extends UserRecord['kind']>(records: UserRecord[], kind: K) =>
  defined(records.find((r): r is Extract<UserRecord, { kind: K }> => r.kind === kind))

describe('readGrtLoad', () => {
  it('reads a load with its cartridge, bullet, maker and powder, each a valid user record', () => {
    const { records, unmapped, warnings } = readGrtLoad(grtFile({}), saved)
    for (const r of records) expect(userRecord.safeParse(r).success, r.kind).toBe(true)
    expect(records.map((r) => r.kind)).toEqual([
      'cartridge',
      'manufacturer',
      'bullet',
      'powder',
      'load',
    ])
    const cartridge = ofKind(records, 'cartridge')
    const bullet = ofKind(records, 'bullet')
    const powder = ofKind(records, 'powder')
    const load = ofKind(records, 'load')
    expect(cartridge.name).toBe('9.1 x 40 Testcal')
    expect(cartridge.data.overrides?.values).toEqual([
      { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 40 },
      { side: 'chamber', symbol: 'Z', quantity: 'length', value: 9.3 },
      { side: 'chamber', symbol: 'Q', quantity: 'area', value: 66.5 },
      { symbol: 'Pmax', quantity: 'pressure', value: 3600 },
    ])
    expect(bullet.name).toBe('Inventa Arms, RN 120')
    expect(bullet.data.manufacturer).toBe(`user:${ofKind(records, 'manufacturer').id}`)
    expect(bullet.data.overrides).toEqual({
      name: 'RN 120',
      diameter: { value: 9.3 },
      mass: { value: 7.8 },
      length: { value: 16.1 },
      ballisticCoefficients: [{ dragModel: 'G1', value: 0.21 }],
    })
    expect(powder.name).toBe('Testpowder Co TP 10')
    expect(powder.data.draft).toEqual({ bulkDensity: { value: 0.95 } })
    expect(load.name).toBe('Testcal load')
    expect(load.data).toEqual({
      origin: 'user',
      cartridge: `user:${cartridge.id}`,
      bullet: `user:${bullet.id}`,
      powder: `user:${powder.id}`,
      powderLot: 'L-77',
      charge: { value: 0.45 },
      seating: { by: 'overallLength', value: { value: 58.2 } },
      note: 'First try',
      analysis: {
        overrides: {
          startPressure: 200,
          sebert: 0.4,
          twist: 300,
          firearmMass: 4200,
          gamma: 1.23,
          density: 1.6,
          propellantTemperature: 20,
        },
      },
    })
    expect(unmapped).toEqual([
      'config.CurveFocusIdx',
      'caliber.casevol',
      'gun.xe',
      'projectile.gTailType',
      'propellant.Ba',
      'propellant.eta',
    ])
    expect(warnings).toEqual([])
  })

  it('accounts for every field with a value: read, not read, or warned about', () => {
    const extra = [['odd', '1', 'furlong'] as Field]
    const text = grtFile({
      sections: { caliber: [['oal', '12', 'mm'], ...extra], gun: [['twistlen', '200', 'in']] },
    })
    const { unmapped, warnings } = readGrtLoad(text, saved)
    expect(unmapped).toContain('caliber.odd')
    expect(warnings).toEqual([
      'gun.twistlen: "200" in unit "in" is not converted; the field is not read.',
    ])
  })

  it('gives the same ids on a second read and one record for a component two files share', () => {
    const a = readGrtLoad(grtFile({}), saved)
    expect(readGrtLoad(grtFile({}), '2027-01-01T00:00:00.000Z').records.map((r) => r.id)).toEqual(
      a.records.map((r) => r.id),
    )
    const b = readGrtLoad(grtFile({ title: 'Other%20load' }), saved)
    expect(ofKind(b.records, 'powder').id).toBe(ofKind(a.records, 'powder').id)
    expect(ofKind(b.records, 'load').id).not.toBe(ofKind(a.records, 'load').id)
  })

  it('converts each value from the unit its field declares', () => {
    const { records } = readGrtLoad(
      grtFile({
        sections: {
          caliber: [
            ['CaliberName', 'C'],
            ['pMaxZul', '360000000', 'Pa'],
            ['caselen', '4', 'cm'],
          ],
          propellant: [
            ['pname', 'P'],
            ['mc', '450', 'mg'],
            ['pcd', '0.95', 'g/cm3'],
            ['pt', '20,5', 'Cel'],
          ],
        },
      }),
      saved,
    )
    expect(ofKind(records, 'cartridge').data.overrides?.values).toEqual([
      { side: 'cartridge', symbol: 'L3', quantity: 'length', value: 40 },
      { symbol: 'Pmax', quantity: 'pressure', value: 3600 },
    ])
    const load = ofKind(records, 'load')
    expect(load.data.charge).toEqual({ value: 0.45 })
    expect(load.data.analysis?.overrides?.propellantTemperature).toBe(20.5)
    expect(ofKind(records, 'powder').data.draft).toEqual({ bulkDensity: { value: 0.95 } })
  })

  it('reads CRLF lines, a byte order mark and a large appendix; measurements and pictures are not read', () => {
    const picture = `<gallery title="p"><picture name="a.jpg" data="${'A'.repeat(80_000)}" /></gallery>`
    const measured =
      '<Measurement><charge name="1" value="0.001"><shot velocity="800" /></charge></Measurement>'
    const { records, unmapped } = readGrtLoad(
      `\uFEFF${grtFile({ eol: '\r\n', appendix: picture + measured, extra: '<caliberfile><var name="a" value="1" /></caliberfile>' })}`,
      saved,
    )
    expect(ofKind(records, 'load').data.note).toBeUndefined()
    expect(unmapped).toEqual(
      expect.arrayContaining(['caliberfile', 'appendix.gallery', 'appendix.Measurement']),
    )
  })

  it('warns on a shotshell load and on text that is not percent-encoded', () => {
    const { warnings, records } = readGrtLoad(
      grtFile({
        title: '100%25%20sure%zz',
        sections: { caliber: [['shotshell', 'true']] },
      }),
      saved,
    )
    expect(warnings[0]).toMatch(/^title: the text is not percent-encoded/)
    expect(warnings[1]).toMatch(/shotshell/)
    expect(ofKind(records, 'load').name).toBe('100%25%20sure%zz')
  })

  it('names a load without title, cartridge, bullet or powder by its kind', () => {
    const { records } = readGrtLoad(grtFile({ title: '', sections: {}, appendix: '' }), saved)
    expect(records).toEqual([
      expect.objectContaining({ kind: 'load', name: 'Load', data: { origin: 'user' } }),
    ])
  })

  it('refuses XML of another root, a file without load and text that is no XML', () => {
    expect(() => readGrtLoad('<other/>', saved)).toThrow('root element')
    expect(() => readGrtLoad('<GordonsReloadingTool/>', saved)).toThrow('no load')
    expect(() => readGrtLoad('<GordonsReloadingTool>', saved)).toThrow()
  })
})
