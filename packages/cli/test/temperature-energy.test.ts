import { interior } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { spansOf, temperatureEnergyCheck } from '../scripts/temperature-energy.mts'
import { loadOf } from '../src/evaluate.ts'
import type { Row } from '../src/rows.ts'
import { records } from './fixture.ts'

const base: Omit<Row, 'charge' | 'velocity' | 'temperature'> = {
  line: 0,
  cartridge: '308-win',
  bullet: 'demo-bullet-168',
  powder: 'demo-powder-dp40',
  barrel: 600,
  pressureBasis: 'transducer',
}

/** A ladder printed by the model itself with the energy term at 0.0003 1/K: a synthetic truth. */
function truthRows(temperatures: number[]): Row[] {
  return temperatures.flatMap((temperature) =>
    [2.0, 2.2, 2.4].map((charge) => {
      const row = { ...base, charge, velocity: 0, temperature }
      const load = loadOf(row, records)
      if (typeof load === 'string') throw new Error(load)
      const r = interior({
        ...load,
        propellant: {
          ...load.propellant,
          temperatureSensitivity: { reference: 294.15, cold: 0.004, hot: 0.004 },
          energyTemperature: 3e-4,
        },
      })
      if (!r.valid) throw new Error(r.reason)
      return { ...row, velocity: r.muzzleVelocity, pressure: r.peakBreechPressure / 1e5 }
    }),
  )
}

describe('spansOf', () => {
  const at = (...ts: number[]) =>
    ts.map((temperature) => ({ row: { ...base, temperature } as Row }))
  const temps = (xs: { row: Row }[] | undefined) => xs?.map((x) => x.row.temperature)

  it('holds out the middle temperatures and the hottest one', () => {
    const s = spansOf(at(-10, 10, 30))
    expect(temps(s.interpolating?.fit)).toEqual([-10, 30])
    expect(temps(s.interpolating?.held)).toEqual([10])
    expect(temps(s.extrapolating?.fit)).toEqual([-10, 10])
    expect(temps(s.extrapolating?.held)).toEqual([30])
  })

  it('gives no span to temperatures closer than 20 K', () => {
    expect(spansOf(at(10, 15, 25))).toEqual({})
  })
})

describe('temperatureEnergyCheck', () => {
  it('prints aggregates only and favours the fixed coefficient beyond the calibrated range when the truth has it', () => {
    const rows = [...truthRows([-10, 10, 30]), { ...base, charge: 2, velocity: 800, line: 9 }]
    const result = temperatureEnergyCheck(rows, records)
    expect(result).toMatchObject({ ladders: 1, rows: 9, skipped: { noTemperature: 1 } })
    const extra = result.spans.extrapolating
    expect(extra).toMatchObject({
      ladders: 1,
      failedFits: 0,
      heldOut: { velocity: 3, pressure: 3 },
    })
    expect(extra.rms.B.velocity).toBeLessThan(extra.rms.A.velocity ?? 0)
    expect(JSON.stringify(result)).not.toMatch(/demo-|308-win/)
  })

  it('fits and scores no crusher pressure', () => {
    const rows = truthRows([-10, 10, 30]).map((r) => ({ ...r, pressureBasis: 'crusher' }))
    const result = temperatureEnergyCheck(rows, records)
    expect(result.spans.extrapolating.heldOut).toEqual({ velocity: 3, pressure: 0 })
    expect(result.skipped.pressureBasis).toBe(6)
  })

  it('counts a ladder without a span', () => {
    const result = temperatureEnergyCheck(truthRows([20, 25]), records)
    expect(result.skipped).toEqual({ 'noSpan:interpolating': 1, 'noSpan:extrapolating': 1 })
    expect(result.spans.interpolating.rms.A).toEqual({ velocity: null, pressure: null })
    expect(result.supported).toBe(false)
  })
})
