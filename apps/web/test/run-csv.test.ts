import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import type { InteriorResponse } from '../src/lib/api-types.ts'
import { curvesCsv, resultsCsv } from '../src/lib/run-csv.ts'
import {
  formatQuantity,
  lengthText,
  msText,
  percentText,
  presetUnits,
  withUnit,
} from '../src/lib/units.ts'

const us = presetUnits('us')
const t = english.t

const points = [
  { time: 0, travel: 0, velocity: 0, burntFraction: 0.01, meanPressure: 1e6, breechPressure: 1e6 },
  {
    time: 4e-4,
    travel: 0.012,
    velocity: 210.5,
    burntFraction: 0.42,
    meanPressure: 2.6e8,
    breechPressure: 2.8e8,
  },
  {
    time: 1.2e-3,
    travel: 0.57,
    velocity: 812.3,
    burntFraction: 1,
    meanPressure: 5e7,
    breechPressure: 5.2e7,
  },
]
const mass = 0.0109

const body = {
  result: {
    points,
    peakBreechPressure: 2.8e8,
    maxPressureTime: 4e-4,
    maxPressureTravel: 0.012,
    muzzleVelocity: 812.3,
    muzzleEnergy: 0.5 * mass * 812.3 ** 2,
    muzzleBreechPressure: 5.2e7,
    barrelTime: 1.1e-3,
    muzzleBurntFraction: 1,
    burnout: { time: 9e-4, travel: 0.3 },
  },
  pressureRange: { nominalPressure: 2.8e8, lowPressure: 2.6e8, highPressure: 3.0e8 },
  limits: [],
} as unknown as InteriorResponse

/** The cells of a CSV line; a quoted cell keeps its comma. */
const cells = (line: string) =>
  [...`${line},`.matchAll(/("(?:[^"]|"")*"|[^,]*),/g)].map((m) =>
    (m[1] ?? '').replace(/^"|"$/g, '').replaceAll('""', '"'),
  )

const lines = (csv: string) => csv.split('\n').map(cells)

describe('the curves download', () => {
  const rows = lines(curvesCsv(points, mass, us, t))

  it('names every column with its unit', () => {
    expect(rows[0]).toEqual([
      'Time (ms)',
      'Travel (in)',
      'Breech pressure (psi)',
      'Velocity (ft/s)',
      'Energy (ft·lbf)',
      'Burnt (%)',
    ])
  })

  it('has one row per time step with the values of the chart data table', () => {
    expect(rows).toHaveLength(points.length + 1)
    points.forEach((p, i) => {
      // the dialog's cells less their units
      const dialog = [
        msText(p.time),
        `${lengthText('travel', us, p.travel)} in`,
        withUnit('pressure', us, p.breechPressure),
        withUnit('velocity', us, p.velocity),
        withUnit('energy', us, 0.5 * mass * p.velocity ** 2),
        percentText(p.burntFraction),
      ].map((cell) => cell.replace(/\s.*$/, ''))
      expect(rows[i + 1]).toEqual(dialog)
    })
  })

  it('holds numbers only, no notice', () => {
    expect(curvesCsv(points, mass, us, t)).not.toMatch(/simulation|safe|load data/i)
  })
})

describe('the results download', () => {
  const rows = lines(resultsCsv(body, 0.0026, us, t))
  const row = (name: string) => rows.find((r) => r[0] === name)

  it('gives each value with its unit', () => {
    expect(rows[0]).toEqual(['Quantity', 'Value', 'Unit'])
    expect(row('Peak pressure')).toEqual([
      'Peak pressure',
      formatQuantity('pressure', us, 2.8e8),
      'psi',
    ])
    expect(row('Corner-case range, low')?.[1]).toBe(formatQuantity('pressure', us, 2.6e8))
    expect(row('Muzzle velocity')).toEqual(['Muzzle velocity', '2665', 'ft/s'])
    expect(row('Charge')).toEqual(['Charge', '40.1', 'gr'])
    expect(row('Barrel time')).toEqual(['Barrel time', '1.100', 'ms'])
    expect(row('Burnout at')).toEqual(['Burnout at', '11.81', 'in'])
  })
})
