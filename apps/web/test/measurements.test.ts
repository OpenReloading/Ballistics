import type { ChronoImport } from '@open-reloading/importers'
import { chronoSession, userRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import type { Shot } from '../src/lib/chrono.ts'
import {
  attachLoad,
  chargeRows,
  type SimulatedStep,
  seriesFlatSpots,
  sessionOf,
  simulatedCurve,
  stringCharge,
  withCharge,
} from '../src/lib/measurements.ts'
import { canonicalJson } from '../src/lib/user-data.ts'
import { defined, missing } from './defined.ts'

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
    const [a = missing(), b = missing(), c = missing()] = rows
    expect(a.velocityStats).toMatchObject({
      count: 3,
      excluded: 0,
      mean: 810,
      extremeSpread: 20,
    })
    expect(a.velocityStats?.standardDeviation).toBeCloseTo(10, 12)
    expect(a.simulatedVelocity).toBe(800)
    expect(a.velocityDifference).toBeCloseTo(10, 12)
    expect(a.differencePercent).toBeCloseTo(1.25, 12)
    expect(b.velocityStats).toMatchObject({
      count: 2,
      excluded: 1,
      mean: 820,
      extremeSpread: 10,
    })
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
    expect(defined(rows[0]).velocityStats).toBeUndefined()
    expect(defined(rows[0]).excludedShots).toEqual([{ velocity: 805, reason: 'misread' }])
    expect(defined(rows[0]).velocityDifference).toBeUndefined()
    expect(defined(rows[1]).velocityStats).toMatchObject({
      count: 1,
      mean: 850,
      standardDeviation: undefined,
      extremeSpread: 0,
    })
    expect(defined(rows[1]).simulatedVelocity).toBeUndefined()
    expect(defined(rows[1]).differencePercent).toBeUndefined()
  })

  it('matches a charge within 0.1 mg and skips a step without a result', () => {
    const rows = chargeRows(
      [{ charge: 40 * gr + 5e-8, shots: [shot(801)] }],
      [{ charge: 40 * gr, muzzleVelocity: undefined }, ...steps.slice(1)],
    )
    expect(defined(rows[0]).simulatedVelocity).toBeUndefined()
    expect(
      defined(chargeRows([{ charge: 41 * gr + 5e-8, shots: [shot(821)] }], steps)[0])
        .simulatedVelocity,
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

describe('sessionOf', () => {
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
  const id = '3f1c2b4e-9a7d-4c1e-8b25-6d0f4a9e7c13'
  const now = new Date('2026-10-12T10:00:00Z')
  const make = (charges: (number | undefined)[]) =>
    sessionOf('day1.csv', data, charges, { id, manufacturer: 'catalogue:test-maker', now })

  it('keeps what the tab shows, each string with its label and charge, as a stored session', () => {
    const s = make([40 * gr, undefined])
    expect(JSON.parse(JSON.stringify(s))).toEqual({
      kind: 'session',
      id,
      name: 'day1.csv',
      saved: '2026-10-12T10:00:00.000Z',
      data: {
        origin: 'user',
        date: '2026-10-12',
        device: { kind: 'doppler-radar', manufacturer: 'catalogue:test-maker', model: 'Radar' },
        muzzleDistance: { value: 3000 },
        strings: [
          {
            label: 'A',
            variation: { kind: 'charge', value: { value: expect.closeTo(40 * gr * 1000, 9) } },
            shots: [shot(800), shot(790, 'flyer')],
          },
          { shots: [shot(810)] },
        ],
        provenance: { kind: 'measured', sources: [{ title: 'day1.csv' }] },
      },
    })
    expect(userRecord.safeParse(s).success).toBe(true)
    // a reopened session serializes as it was stored, so a load opens without unsaved changes
    expect(canonicalJson(userRecord.parse(s))).toBe(canonicalJson(s))
    expect(s.data.strings.map(stringCharge)).toEqual([expect.closeTo(40 * gr, 12), undefined])
  })

  it('keeps a file without a maker, a date or a model, and cuts texts to the caps', () => {
    const long = 'x'.repeat(300)
    const bare = { ...data.session, date: undefined, device: { kind: 'other' as const } }
    const s = sessionOf(long, { ...data, session: bare, stringLabels: [long] }, [], { id, now })
    expect(s.name).toHaveLength(200)
    expect(s.data.device).toEqual({ kind: 'other' })
    expect(s.data.date).toBeUndefined()
    expect(chronoSession.safeParse(s.data).success).toBe(true)
    // the source title falls back to the name when the file gave none
    const untitled = {
      ...data.session,
      provenance: { kind: 'measured' as const, sources: [{}] as [object] },
    }
    const t = sessionOf('x.csv', { ...data, session: untitled }, [], { id, now })
    expect(defined(t.data.provenance.sources[0]).title).toBe('x.csv')
  })

  it('maps a string to a charge and back to not used', () => {
    const string = make([undefined, undefined]).data.strings[0]
    const mapped = withCharge(defined(string), 41 * gr)
    expect(stringCharge(mapped)).toBeCloseTo(41 * gr, 12)
    expect(withCharge(mapped, undefined)).toEqual(string)
    expect(stringCharge(defined(string))).toBeUndefined()
  })

  it('names the load on the mapped strings that name none, and no other', () => {
    const s = make([40 * gr, undefined])
    const attached = attachLoad(s, 'user:7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57')
    expect(attached.data.strings.map((x) => x.load)).toEqual([
      'user:7a2d9c10-5b3e-4f68-9d41-0c8e2b6a1f57',
      undefined,
    ])
    // a string that names a load keeps it, and the same session comes back when nothing changes
    expect(attachLoad(attached, 'user:3f1c2b4e-0000-4000-8000-000000000000')).toBe(attached)
    expect(attachLoad(make([undefined, undefined]), 'user:x')).toEqual(make([undefined, undefined]))
    // a load whose id is no reference (no UUID) is named by no string
    expect(attachLoad(s, undefined)).toBe(s)
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
    expect(defined(r?.flatSpots[0]).counts).toEqual([5, 5, 5])
  })

  it('needs two charges with two shots each', () => {
    expect(seriesFlatSpots(chargeRows([string(40, [700, 710, 705])], []))).toBeUndefined()
    expect(
      seriesFlatSpots(chargeRows([string(40, [700, 710]), string(41, [705])], [])),
    ).toBeUndefined()
  })
})
