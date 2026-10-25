import type { ChronoImport } from '@open-reloading/importers'
import { measurementSeries } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import type { Shot } from '../src/lib/chrono.ts'
import {
  chargeRows,
  type SimulatedStep,
  seriesFlatSpots,
  seriesFromLoad,
  seriesOf,
  seriesToLoad,
  simulatedCurve,
} from '../src/lib/measurements.ts'

const shot = (value: number, excluded?: string): Shot => ({
  velocity: { value },
  ...(excluded ? { excluded } : {}),
})
const gr = 0.0000647989
const steps: SimulatedStep[] = [
  { charge: 40 * gr, muzzleVelocity: 800 },
  { charge: 41 * gr, muzzleVelocity: 820 },
  { charge: 42 * gr, muzzleVelocity: 840 },
]

describe('chargeRows', () => {
  // hand calculation, velocities in m/s:
  // 40 gr: 800, 810, 820 -> mean 810, SD sqrt((100 + 0 + 100) / 2) = 10, ES 20, diff 10, 1.25 %
  // 41 gr: 815, 825 (and 790 excluded) -> mean 820, SD sqrt(50) = 7.0711, ES 10, diff 0, 0 %
  // 42 gr: two strings pooled, 830, 834 and 838 -> mean 834, SD 4, ES 8, diff -6, -0.7143 %
  const strings = [
    { charge: 40 * gr, shots: [shot(800), shot(810), shot(820)] },
    { charge: 41 * gr, shots: [shot(815), shot(790, 'flyer'), shot(825)] },
    { charge: 42 * gr, shots: [shot(830), shot(834)] },
    { charge: 42 * gr, shots: [shot(838)] },
    { charge: undefined, shots: [shot(700)] },
  ]

  it('pools the strings of a charge and compares the mean with the simulated velocity', () => {
    const rows = chargeRows(strings, steps)
    expect(rows.map((r) => r.charge)).toEqual([40 * gr, 41 * gr, 42 * gr])
    const [a, b, c] = rows
    expect(a.velocityStats).toMatchObject({ count: 3, excluded: 0, mean: 810, extremeSpread: 20 })
    expect(a.velocityStats?.standardDeviation).toBeCloseTo(10, 12)
    expect(a.simulatedVelocity).toBe(800)
    expect(a.velocityDifference).toBeCloseTo(10, 12)
    expect(a.differencePercent).toBeCloseTo(1.25, 12)
    expect(b.velocityStats).toMatchObject({ count: 2, excluded: 1, mean: 820, extremeSpread: 10 })
    expect(b.velocityStats?.standardDeviation).toBeCloseTo(Math.sqrt(50), 12)
    expect(b.velocityDifference).toBeCloseTo(0, 12)
    expect(b.excludedShots).toEqual([{ velocity: 790, reason: 'flyer' }])
    expect(c.velocityStats).toMatchObject({ count: 3, mean: 834, extremeSpread: 8 })
    expect(c.velocityStats?.standardDeviation).toBeCloseTo(4, 12)
    expect(c.velocityDifference).toBeCloseTo(-6, 12)
    expect(c.differencePercent).toBeCloseTo((-6 / 840) * 100, 12)
  })

  it('keeps a charge without a simulated step, one shot and a string with every shot excluded', () => {
    const rows = chargeRows(
      [
        { charge: 43 * gr, shots: [shot(850)] },
        { charge: 40 * gr, shots: [shot(805, 'misread')] },
      ],
      steps,
    )
    expect(rows.map((r) => r.charge)).toEqual([40 * gr, 43 * gr])
    expect(rows[0].velocityStats).toBeUndefined()
    expect(rows[0].excludedShots).toEqual([{ velocity: 805, reason: 'misread' }])
    expect(rows[0].velocityDifference).toBeUndefined()
    expect(rows[1].velocityStats).toMatchObject({
      count: 1,
      mean: 850,
      standardDeviation: undefined,
      extremeSpread: 0,
    })
    expect(rows[1].simulatedVelocity).toBeUndefined()
    expect(rows[1].differencePercent).toBeUndefined()
  })

  it('matches a charge within 0.1 mg and skips a step without a result', () => {
    const rows = chargeRows(
      [{ charge: 40 * gr + 5e-8, shots: [shot(801)] }],
      [{ charge: 40 * gr, muzzleVelocity: undefined }, ...steps.slice(1)],
    )
    expect(rows[0].simulatedVelocity).toBeUndefined()
    expect(
      chargeRows([{ charge: 41 * gr + 5e-8, shots: [shot(821)] }], steps)[0].simulatedVelocity,
    ).toBe(820)
  })
})

describe('simulatedCurve', () => {
  it('lists the steps with a velocity in charge order', () => {
    const down = [...steps].reverse()
    down.splice(1, 1, { charge: 41 * gr, muzzleVelocity: undefined })
    expect(simulatedCurve(down)).toEqual([steps[0], steps[2]])
  })
})

describe('seriesOf', () => {
  const data: ChronoImport = {
    format: 'openreloading-csv',
    session: {
      date: '2026-10-12',
      device: { kind: 'doppler-radar', manufacturerName: 'Manufacturer', model: 'Radar' },
      muzzleDistance: { value: 3000 },
      strings: [{ shots: [shot(800), shot(790, 'flyer')] }, { shots: [shot(810)] }],
      provenance: { kind: 'measured', sources: [{ title: 'day1.csv' }] },
    },
    stringLabels: ['A', undefined],
    velocityUnits: [],
    missingPaths: [],
    warnings: [],
  }

  it('keeps what the tab shows, each string with its label and charge, as a load file entry', () => {
    const s = seriesOf('day1.csv', data, [40 * gr, undefined])
    expect(JSON.parse(JSON.stringify(s))).toEqual({
      name: 'day1.csv',
      date: '2026-10-12',
      device: 'Manufacturer Radar',
      muzzleDistance: 3,
      strings: [
        { label: 'A', charge: 40 * gr, shots: [shot(800), shot(790, 'flyer')] },
        { shots: [shot(810)] },
      ],
    })
    // a reopened load serializes as it was saved, so it opens without unsaved changes
    const stored = seriesToLoad(s)
    expect(JSON.stringify(measurementSeries.parse(stored))).toBe(JSON.stringify(stored))
    expect(stored.muzzleDistance).toEqual({ value: 3000 })
    expect(stored.strings[0].charge?.value).toBeCloseTo(40 * (gr * 1000), 9)
    const back = seriesFromLoad(stored)
    expect(back.muzzleDistance).toBe(3)
    expect(back.strings[0].charge).toBeCloseTo(40 * gr, 12)
    expect(JSON.stringify(seriesToLoad(back))).toBe(JSON.stringify(stored))
  })

  it('cuts texts to the caps of the file', () => {
    const long = 'x'.repeat(300)
    const s = seriesOf(long, { ...data, stringLabels: [long] }, [])
    expect(measurementSeries.safeParse(seriesToLoad(s)).success).toBe(true)
  })
})

describe('seriesFlatSpots', () => {
  const string = (n: number, velocities: number[]) => ({
    charge: n * gr,
    shots: velocities.map((v) => shot(v)),
  })

  it('finds a flat spot over charges whose strings differ by less than their scatter', () => {
    const rows = chargeRows(
      [
        string(40, [700, 710, 705, 695, 700]),
        string(41, [702, 712, 707, 697, 702]),
        string(42, [704, 714, 709, 699, 704]),
        string(43, [760, 770, 765, 755, 760]),
      ],
      [],
    )
    const r = seriesFlatSpots(rows)
    expect(r?.flatSpots).toHaveLength(1)
    expect(r?.flatSpots[0].counts).toEqual([5, 5, 5])
  })

  it('needs two charges with two shots each', () => {
    expect(seriesFlatSpots(chargeRows([string(40, [700, 710, 705])], []))).toBeUndefined()
    expect(
      seriesFlatSpots(chargeRows([string(40, [700, 710]), string(41, [705])], [])),
    ).toBeUndefined()
  })
})
