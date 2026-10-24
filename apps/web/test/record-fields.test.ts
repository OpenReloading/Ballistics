import type { Bullet, Powder, Provenance } from '@openreloading/schema'
import { expect, it } from 'vitest'
import {
  ballisticCoefficientRows,
  buildRows,
  bulletDataGroups,
  bulletStrip,
  burnFormRows,
  type FieldRow,
  fittedParameterRows,
  intervalText,
  modelInputRows,
  powderParameterGroups,
  powderRowGroups,
  powderStrip,
  rowLabel,
  rowNotes,
  rowParts,
  rowValue,
} from '../src/lib/record-fields.ts'
import { presetUnits } from '../src/lib/units.ts'
import { targetBullet } from './fixtures/bullets.ts'

const provenance: Provenance = { kind: 'published', sources: [] }
const grains = presetUnits('metric-grains')
const us = presetUnits('us')
const si = presetUnits('metric-grams')

/** Label and shown value of each row in a preset. */
const shown = (rows: FieldRow[], system = grains) =>
  rows.map((r) => [rowLabel(r, system), rowValue(r, system)])

const target = targetBullet

/** The rows of a bullet's data groups, the computed ones left out. */
const dataRows = (b: Bullet) =>
  bulletDataGroups(b)
    .filter((g) => g.title !== 'Computed')
    .flatMap((g) => g.rows)

it('splits the build into structure, jacket, core and surface, the manufacturer wording as printed on the first', () => {
  const row = (construction: Bullet['construction']) => shown(buildRows(construction))
  const notes = (construction: Bullet['construction']) => buildRows(construction).map(rowNotes)
  const mapped = { raw: 'Jacketed Lead', core: { material: 'lead' }, jacket: {} } as const
  expect(row(mapped)).toEqual([
    ['Jacket', 'yes'],
    ['Core', 'lead'],
  ])
  expect(notes(mapped)).toEqual([['As printed: Jacketed Lead'], []])
  const amp = {
    raw: 'AMP',
    structure: 'cup-and-core',
    core: { material: 'lead-alloy' },
    jacket: { material: 'gilding-metal' },
  } as const
  expect(row(amp)).toEqual([
    ['Structure', 'cup-and-core'],
    ['Jacket', 'gilding metal'],
    ['Core', 'lead alloy'],
  ])
  expect(row({ raw: 'Moly', surface: ['moly'] })).toEqual([['Surface', 'moly']])
  const raw = { raw: 'Copper', unmapped: true } as const
  expect(row(raw)).toEqual([['Construction', 'Copper']])
  expect(notes(raw)).toEqual([[]])
  expect(row(undefined)).toEqual([])
})

it('shows each bullet dimension once, in the unit of each preset, rounded', () => {
  const rows = dataRows(target)
  expect(shown(rows, grains)).toEqual([
    ['Diameter', '7.82 mm'],
    ['Mass', '168.0 gr'],
    ['Length', '32.00 mm'],
    ['Nose length', '20.00 mm'],
    ['Base to ogive', '14.00 mm'],
    ['Bearing length', '6.50 mm'],
    ['Base length', '5.50 mm'],
    ['Recommended twist', '1 turn in 12.0 in'],
  ])
  expect(shown(rows, us)).toEqual([
    ['Diameter', '.3080 in'],
    ['Mass', '168.0 gr'],
    ['Length', '1.2598 in'],
    ['Nose length', '.7874 in'],
    ['Base to ogive', '.5512 in'],
    ['Bearing length', '.2559 in'],
    ['Base length', '.2165 in'],
    ['Recommended twist', '1 turn in 12.0 in'],
  ])
  expect(shown(rows, si).slice(0, 2)).toEqual([
    ['Diameter', '7.82 mm'],
    ['Mass', '10.89 g'],
  ])
  expect(shown(rows, si).at(-1)).toEqual(['Recommended twist', '1 turn in 305 mm'])
})

it('keeps the text as printed for the hover notes, not in the value', () => {
  const twist = dataRows(target).at(-1) as FieldRow
  expect(rowNotes(twist)).toEqual(['As printed: 1:12"'])
  expect(rowNotes(dataRows(target)[0])).toEqual([])
})

it('leaves the identity fields to the title and badges and gives text fields as they are', () => {
  const b: Bullet = {
    id: 'x',
    manufacturer: 'example',
    productNumber: '1',
    productLine: 'Line',
    caliber: '.308',
    name: 'X',
    diameter: { value: 7.823 },
    mass: { value: 10.886 },
    base: { type: 'boat-tail', diameter: { value: 6.35 }, angle: { value: 8.333333333333334 } },
    ogive: { radius: { value: 63.5 }, radiusRatio: { value: 0.5 } },
    tip: { type: 'polymer-tip', length: { value: 3.175 } },
    meplatDiameter: { value: 1.27, raw: '.050"' },
    provenance,
  }
  const rows = shown(dataRows(b))
  expect(rows.map(([label]) => label)).not.toContain('Manufacturer')
  expect(rows.map(([label]) => label)).not.toContain('Caliber')
  expect(rows).toEqual([
    ['Diameter', '7.82 mm'],
    ['Mass', '168.0 gr'],
    ['Ogive radius', '63.50 mm'],
    ['Ogive radius ratio', '0.500'],
    ['Meplat diameter', '1.27 mm'],
    ['Tip', 'polymer-tip'],
    ['Tip length', '3.18 mm'],
    ['Base type', 'boat-tail'],
    ['Base diameter', '6.35 mm'],
    ['Boat-tail angle', '8.3333 deg'],
  ])
  // the groups the record fills, each dimension with its drawing symbol
  expect(bulletDataGroups(b).map((g) => g.title)).toEqual([
    'Size',
    'Shape',
    'Tip and base',
    'Computed',
  ])
  expect(dataRows(b).map((r) => r.symbol)).toEqual([
    'd',
    undefined,
    'R',
    'Rt/R',
    'dm',
    undefined,
    'lt',
    undefined,
    'db',
    undefined,
  ])
})

it('gives the ballistic coefficients with their band in the velocity unit and the note on hover', () => {
  const b: Bullet = {
    ...target,
    ballisticCoefficients: [
      { dragModel: 'G1', value: 0.505, minVelocity: { value: 792.48 } },
      { dragModel: 'G1', value: 0.48 },
      { dragModel: 'G7', value: 0.264, note: 'G7 form factor 0.960' },
    ],
  }
  const rows = ballisticCoefficientRows(b)
  expect(shown(rows, us)).toEqual([
    ['G1 from 2600 ft/s', '0.505 lb/in²'],
    ['G1', '0.480 lb/in²'],
    ['G7', '0.264 lb/in²'],
  ])
  expect(rowLabel(rows[0], si)).toBe('G1 from 792 m/s')
  expect(rowNotes(rows[2])).toEqual(['G7 form factor 0.960'])
})

it('leaves the powder properties of the strip out of the Properties table', () => {
  expect(
    powderRowGroups({
      id: 'a',
      manufacturer: 'example-a',
      name: 'Powder A',
      grainForm: 'ball',
      propellantBase: 'double',
      country: 'US',
      bulkDensity: { value: 0.9512, raw: 'VMD 0.0681 cm³/gr' },
      provenance,
    }),
  ).toEqual([
    { rows: [] },
    { title: 'Composition', rows: [] },
    { title: 'Thermochemistry', rows: [] },
  ])
})

it('gives the aliases, the composition and the computed thermochemistry with its range on hover', () => {
  const [identity, composition, thermo] = powderRowGroups({
    id: 'a',
    manufacturer: 'example-c',
    name: 'Powder X',
    aliases: ['Example D X1'],
    grainForm: 'extruded',
    propellantBase: 'single',
    composition: [
      { name: 'Nitrocellulose', cas: '9004-70-0', min: 60, max: 100, raw: '>60' },
      { name: 'Graphite', min: 1, max: 1 },
    ],
    thermochemistry: {
      loadingDensity: { value: 0.1 },
      flameTemperature: { value: 2800, min: 2400, max: 3200 },
      impetus: { value: 1000000, min: 900000, max: 1100000 },
      gamma: { value: 1.24, min: 1.22, max: 1.26 },
      molarMass: { value: 23.7, min: 22.3, max: 25.3 },
      covolume: { value: 0.001, min: 0.00095, max: 0.00105 },
    },
    provenance,
  })
  expect(shown(identity.rows)).toEqual([['Aliases', 'Example D X1']])
  expect(shown(composition.rows)).toEqual([
    ['Nitrocellulose', '60 to 100 %'],
    ['Graphite', '1 %'],
  ])
  expect(rowNotes(composition.rows[0])).toEqual(['As printed: >60'])
  expect(shown(thermo.rows)).toEqual([
    ['Loading density', '0.1 g/cm³'],
    ['Flame temperature', '2800 K'],
    ['Impetus', '1000000 J/kg'],
    ['Ratio of specific heats', '1.24'],
    ['Molar mass', '23.7 kg/kmol'],
    ['Covolume', '0.001 m³/kg'],
  ])
  expect(rowNotes(thermo.rows[2])).toEqual(['Over the composition ranges: 900000 to 1100000.'])
})

it('rounds a value row to significant digits when asked', () => {
  const row: FieldRow = {
    label: 'Reference pressure',
    value: { quantity: 'pressure', si: 98066.5, significantDigits: 3 },
  }
  expect(rowValue(row, grains)).toBe('0.981 bar')
  expect(rowValue(row, us)).toBe('14.2 psi')
  expect(
    rowValue(
      { label: 'Stress', value: { quantity: 'pressure', si: 0, significantDigits: 3 } },
      grains,
    ),
  ).toBe('0 bar')
})

it('rounds a fitted value to its interval: two significant digits, the percent whole above 10', () => {
  const plain = (t: string) => t.replaceAll('\u00a0', ' ')
  expect(plain(intervalText(0.18342, 0.052))).toBe('0.183 ± 0.052 (± 28 %)')
  expect(plain(intervalText(8.7243, 2.8))).toBe('8.7 ± 2.8 (± 32 %)')
  expect(plain(intervalText(11.236, 6))).toBe('11.2 ± 6.0 (± 53 %)')
  expect(plain(intervalText(0.61237, 0.03))).toBe('0.612 ± 0.030 (± 4.9 %)')
  expect(intervalText(0.5, undefined)).toBe('0.5')
  // one breaking space: before the percent
  expect(intervalText(0.61237, 0.03).split(' ')).toEqual([
    '0.612\u00a0±\u00a00.030',
    '(±\u00a04.9\u00a0%)',
  ])
})

it('gives the fitted values with intervals, the fixed inputs from their stored units and the burn form by symbol', () => {
  const p = {
    id: 'a',
    manufacturer: 'example-a',
    name: 'Powder B',
    interior: {
      model: 'm3',
      fitted: ['vivacity', 'energy'],
      vivacity: { value: 0.18342, standardUncertainty: 0.026 },
      energy: { value: 8724300, standardUncertainty: 1400000 },
      gamma: 1.2388,
      covolume: { value: 0.0010412 },
      density: { value: 1.6 },
      pressureExponent: 1,
      referencePressure: { value: 0.980665 },
      ignitionPressure: { value: 50 },
      propellantTemperature: { value: 21 },
      resistance: { stress: { value: 4.2 }, oversize: 1.3, engraving: 0 },
      burnForm: { kind: 'twoStage', a: { value: 0 }, m: 0.5, q: 0.5, z1: 0.8 },
      trainingRows: 120,
      trainingCartridges: 15,
    },
    provenance,
  } as Powder
  expect(shown(fittedParameterRows(p, 2, { value: 2.39, median: 0.78, powders: 30 }))).toEqual([
    ['Vivacity', '0.183\u00a0±\u00a00.052 (±\u00a028\u00a0%) 1/s'],
    ['Energy', '8.7\u00a0±\u00a02.8 (±\u00a032\u00a0%) MJ/kg'],
    ['Energy ratio', '2.39'],
  ])
  expect(rowParts(fittedParameterRows(p, 2)[0], us)).toEqual({
    number: '0.183\u00a0±\u00a00.052 (±\u00a028\u00a0%)',
    unit: '1/s',
  })
  expect(shown(modelInputRows(p))).toEqual([
    ['Ratio of specific heats', '1.239'],
    ['Covolume', '1.04 cm³/g'],
    ['Solid density', '1.60 g/cm³'],
    ['Reference pressure', '0.981 bar'],
    ['Ignition pressure', '50.0 bar'],
    ['Start pressure', 'per load row'],
    ['Propellant temperature', '21.0 °C'],
    ['Pressure exponent', '1'],
    ['Bore resistance', '4.20 bar'],
  ])
  expect(burnFormRows(p).map((r) => [r.symbol, r.label, r.text])).toEqual([
    ['a', 'Burn form a', '0'],
    ['m', 'Burn form m', '0.5'],
    ['q', 'Burn form q', '0.5'],
    ['z1', 'Burn form z1', '0.8'],
  ])
  expect(powderParameterGroups(p, 2).map((g) => [g.title, g.filter, g.rows.length])).toEqual([
    ['Fitted (simulated, with 2 standard uncertainties)', 'Fitted', 2],
    ['Fixed model inputs', 'Fixed inputs', 9],
    ['Burn form, two-stage', 'Fixed inputs', 4],
  ])
  const formFitted = {
    ...p,
    interior: { ...p.interior, fitted: ['vivacity', 'form.a'] },
  } as Powder
  expect(fittedParameterRows(formFitted, 2).at(-1)?.symbol).toBe('a')
  expect(burnFormRows(formFitted).map((r) => r.symbol)).toEqual(['m', 'q', 'z1'])
  expect(rowNotes(modelInputRows(p)[8])).toEqual([
    'Stress; groove oversize 1.3 per percent, engraving 0 of the start pressure.',
  ])
  expect(shown(modelInputRows(p), us)[6]).toEqual(['Propellant temperature', '69.8 °F'])
})

it('the bullet strip has diameter, mass, length, the G7 BC where given and the sectional density, nothing the record lacks', () => {
  const strip = bulletStrip(target)
  expect(strip.map((i) => i.label)).toEqual([
    'Diameter',
    'Mass',
    'Length',
    'BC G7',
    'Sectional density',
  ])
  expect(strip.slice(0, 3).map((i) => rowValue(i.row, us))).toEqual([
    '.3080 in',
    '168.0 gr',
    '1.2598 in',
  ])
  const bc = target.ballisticCoefficients?.find((c) => c.dragModel === 'G7')
  expect(rowValue(strip[3].row, us)).toBe(`${bc?.value.toFixed(3)} lb/in²`)
  const bare = { ...target, length: undefined, ballisticCoefficients: undefined }
  expect(bulletStrip(bare).map((i) => i.label)).toEqual(['Diameter', 'Mass', 'Sectional density'])
})

it('the powder strip has manufacturer, form, base, the burn-rate position, the solid and the bulk density where known', () => {
  const p = {
    manufacturer: 'example-a',
    grainForm: 'extruded',
    propellantBase: 'double',
    interior: { density: { value: 1.6 } },
    bulkDensity: { value: 0.93 },
  } as Powder
  expect(
    powderStrip(p, { order: 40, total: 220 }, 'Example A').map((i) => [
      i.label,
      rowValue(i.row, grains),
    ]),
  ).toEqual([
    ['Manufacturer', 'Example A'],
    ['Form', 'extruded'],
    ['Base', 'double'],
    ['Burn rate', '40 of 220 1 = fastest'],
    ['Solid density', '1.60 g/cm³'],
    ['Bulk density', '0.93 g/cm³'],
  ])
  expect(powderStrip({ manufacturer: 'x' } as Powder, undefined, 'X').map((i) => i.label)).toEqual([
    'Manufacturer',
  ])
})

it('splits a value from its unit for the unit column, a text row with its own unit too', () => {
  const [diameter] = dataRows(target)
  expect(rowParts(diameter, us)).toEqual({ number: '.3080', unit: 'in' })
  const twist = dataRows(target).at(-1) as FieldRow
  expect(rowParts(twist, us)).toEqual({ number: '1 turn in 12.0', unit: 'in' })
  expect(rowParts({ label: 'Angle', text: '9', unit: 'deg' }, us)).toEqual({
    number: '9',
    unit: 'deg',
  })
  expect(rowParts({ label: 'Tip', text: 'hollow-point' }, us)).toEqual({
    number: 'hollow-point',
    unit: '',
  })
})
