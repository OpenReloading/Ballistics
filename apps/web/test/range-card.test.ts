import { lbPerSqInToKgPerSqM, type TrajectoryPoint } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { rangeCardColumns, rangeCardFacts, rangeCardRows } from '../src/lib/range-card.ts'
import { presetUnits } from '../src/lib/units.ts'

const moa = Math.PI / 180 / 60
const point = {
  range: 91.44,
  time: 0.1234,
  velocity: 800,
  energy: 3000,
  height: -0.0254,
  elevationHold: moa,
  windageHold: -2 * moa,
} as TrajectoryPoint

describe('range card', () => {
  it('lists the rows in the correction unit of the system', () => {
    expect(rangeCardRows([point], presetUnits('us'))).toEqual([
      ['100', '-1.0', '1.00', '-2.00', '2625', '2213', '0.123'],
    ])
    const mil = rangeCardRows([point], presetUnits('metric-grains'))[0]
    expect(mil[2]).toBe('0.29')
    expect(rangeCardColumns(presetUnits('us'))).toEqual([
      'Range (yd)',
      'Height (in)',
      'Elevation (MOA)',
      'Windage (MOA)',
      'Velocity (ft/s)',
      'Energy (ft·lbf)',
      'Time (s)',
      'Notes',
    ])
    expect(rangeCardColumns(presetUnits('metric-grains'))[2]).toBe('Elevation (mrad)')
  })

  it('gives the holds in clicks and the wind brackets per 1 m/s and per 1 mph', () => {
    const us = presetUnits('us')
    // a quarter MOA click: the elevation of 1 MOA is 4 clicks
    const extras = { click: moa / 4, wind: { mps: [0.5 * moa], mph: [0.2 * moa] } }
    expect(rangeCardColumns(us, extras)).toEqual([
      'Range (yd)',
      'Height (in)',
      'Elevation (MOA / clicks)',
      'Windage (MOA)',
      'Velocity (ft/s)',
      'Energy (ft·lbf)',
      'Time (s)',
      'Wind per 1 m/s (MOA / clicks)',
      'Wind per 1 mph (MOA / clicks)',
      'Notes',
    ])
    expect(rangeCardRows([point], us, extras)[0]).toEqual([
      '100',
      '-1.0',
      '1.00 / 4.0',
      '-2.00',
      '2625',
      '2213',
      '0.123',
      '0.50 / 2.0',
      '0.20 / 0.8',
    ])
  })

  it('heads the card with the inputs of the result', () => {
    const facts = rangeCardFacts(
      { muzzleVelocity: 800, sightHeight: 0.04, temperature: 288.15, windSpeed: 0 },
      100,
      presetUnits('metric-grains'),
    )
    expect(Object.fromEntries(facts)).toMatchObject({
      'Muzzle velocity': '800 m/s',
      Zero: '100 m',
      'Sight height': '40 mm',
      Wind: 'none',
    })
    expect(facts[3][1]).toBe(
      '15 °C, station pressure not given, altitude not given, humidity not given',
    )
  })

  it('adds the zero air and the drag factor with its source, only when set', () => {
    const system = presetUnits('metric-grains')
    const shot = { temperature: 288.15, pressure: 101325, humidity: 0.5 }
    const names = (si: Record<string, number>, source?: string) =>
      Object.fromEntries(rangeCardFacts(si, 100, system, false, source))
    expect(names(shot)).not.toHaveProperty(['Zero air'])
    expect(names(shot)).not.toHaveProperty(['Drag factor'])
    const set = names(
      { ...shot, zeroTemperature: 308.15, dragFactor: 1.034 },
      'Truing session of 2026-09-14',
    )
    // the zero air fields left empty show the shot's values
    expect(set['Zero air']).toBe('35 °C, station pressure 1013.3 hPa, humidity 50 %')
    expect(set['Drag factor']).toBe('103.4 %, Truing session of 2026-09-14')
    expect(names({ ...shot, dragFactor: 0.97 })['Drag factor']).toBe('97 %')
  })

  it('leads with mass and BC for a manual bullet', () => {
    const facts = rangeCardFacts(
      { mass: 0.0108864, ballisticCoefficient: 0.243 * lbPerSqInToKgPerSqM },
      100,
      presetUnits('us'),
      true,
    )
    expect(facts[0][0]).toBe('Bullet')
    expect(facts[0][1]).toMatch(/^168 gr, BC 0\.243 /)
  })
})
