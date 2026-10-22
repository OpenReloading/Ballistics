import { lbPerSqInToKgPerSqM, type TrajectoryPoint } from '@openreloading/core'
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
      'Clicks, notes',
    ])
    expect(rangeCardColumns(presetUnits('metric-grains'))[2]).toBe('Elevation (mrad)')
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
