import {
  lbPerSqInToKgPerSqM,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  blankChrono,
  blankRow,
  fitSession,
  nominalLine,
  parameterLines,
  planSession,
  residualLines,
  type TruingInputs,
  type TruingRow,
  truingEntry,
  truingSummary,
  withTruing,
} from '../src/lib/truing-session.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

const system = presetUnits('us')
const click = 0.1e-3
const dispersion = 0.2e-3
const shots = 5

const drag = (bc: number) => ({
  kind: 'bc' as const,
  model: 'G7' as const,
  bands: [{ ballisticCoefficient: bc * lbPerSqInToKgPerSqM, minVelocity: 0 }],
})
const shotOf = (v: number, bc: number): TrajectoryInput => ({
  projectile: { mass: 0.01134, diameter: 0.00782, length: 0.0312, drag: drag(bc) },
  muzzleVelocity: v,
  firearm: { sightHeight: 0.05 },
  air: standardAtmosphere(0),
  zero: { range: 100 },
})
const nominal = shotOf(790, 0.3)
/** The shot the strings were made from: faster, and a drag factor of 0.97 (the BC divided by it). */
const truth = { v: 800, k: 0.97, c: 1.02 }

/** Standard normal draws fixed in advance, one per row. */
const noise = [0.4, -0.7, 0.2, 0.9, -0.3, 0.5, -0.2]
/** A number as the field would hold it. */
const text = (x: number) => String(x)

/** Strings the solver gives for the true shot, in the units of `system`. */
function measured(impacts: number[], dials: number[]): TruingInputs {
  const t = trajectory(shotOf(truth.v, 0.3 / truth.k), [...impacts, ...dials, 0])
  const at = (range: number) => {
    const p = t.points.find((q) => q.range === range)
    if (!p) throw new Error(`range ${range}`)
    return p
  }
  const rows: TruingRow[] = [
    ...impacts.map((range, i): TruingRow => {
      const spread = dispersion * range
      return {
        kind: 'impact',
        range: text(system.range.fromSi(range)),
        shots: text(shots),
        mean: text(
          system.lineOfSightOffset.fromSi(
            at(range).height + (defined(noise[i]) * spread) / Math.sqrt(shots),
          ),
        ),
        deviation: text(system.lineOfSightOffset.fromSi(spread)),
      }
    }),
    ...dials.map((range, i): TruingRow => {
      const spread = dispersion / click
      const clicks = at(range).elevationHold / (click * truth.c)
      return {
        kind: 'dial',
        range: text(system.range.fromSi(range)),
        shots: text(shots),
        mean: text(
          Math.round(clicks + (defined(noise[impacts.length + i]) * spread) / Math.sqrt(shots)),
        ),
        deviation: text(spread),
      }
    }),
  ]
  return {
    rows,
    chrono: {
      shots: '10',
      mean: text(system.velocity.fromSi(at(0).velocity + (defined(noise[6]) * 4) / Math.sqrt(10))),
      deviation: text(system.velocity.fromSi(4)),
    },
    click: text(system.correction.fromSi(click)),
    dispersion: text(system.correction.fromSi(dispersion)),
    fitZeroOffset: false,
    system,
  }
}

const at = (lines: ReturnType<typeof parameterLines>, name: string) => {
  const line = lines.find((l) => l.name === name)
  if (!line) throw new Error(name)
  return line
}

describe('fit of the typed strings', () => {
  const input = measured([300, 600, 900], [400, 700, 1000])
  const fit = fitSession(nominal, input, english.t)

  it('gives a result within the stated intervals for strings made with the solver', () => {
    if (!('answer' in fit)) throw new Error(fit.problem)
    const wanted = { muzzleVelocity: truth.v, dragFactor: truth.k, clickValue: click * truth.c }
    for (const p of fit.answer.parameters) {
      expect(p.status).toBe('identified')
      const { lower, upper } = p.interval as { lower: number; upper: number }
      const x = wanted[p.name as keyof typeof wanted]
      expect(x).toBeGreaterThanOrEqual(lower)
      expect(x).toBeLessThanOrEqual(upper)
    }
    expect(fit.answer.consistent).toBe(true)
    expect(residualLines(fit.answer, english.t)).toHaveLength(1)
  })

  it('shows value, interval and level of an identified parameter in the shown units', () => {
    if (!('answer' in fit)) throw new Error(fit.problem)
    const v = at(parameterLines(fit.answer.parameters, system, english.t), 'muzzleVelocity')
    expect(v.statusText).toBe('Identified')
    expect(v.value).toMatch(/^26\d\d ft\/s$/)
    expect(v.interval).toMatch(/ft\/s to \d+ ft\/s \(95 %\)$/)
  })
})

describe('a parameter the data cannot separate', () => {
  it('is named weak or unresolved and shows no value', () => {
    // one impact distance: no clicks dialled, and speed and drag cannot be told apart
    const input = { ...measured([300], []), chrono: blankChrono }
    const fit = fitSession(nominal, input, english.t)
    if (!('answer' in fit)) throw new Error(fit.problem)
    const lines = parameterLines(fit.answer.parameters, system, english.t)
    expect(at(lines, 'clickValue').status).toBe('unresolved')
    for (const l of lines.filter((x) => x.status !== 'identified')) {
      expect(l.value).toBeUndefined()
      expect(l.interval).toBeUndefined()
      expect(l.statusText).toMatch(/^(Weak|Unresolved): /)
    }
    expect(lines.some((l) => l.status === 'weak' || l.status === 'unresolved')).toBe(true)
  })

  it('is flagged in the plan before any shot', () => {
    const rows = [{ ...blankRow(), range: '300', shots: '5' }]
    const plan = planSession(
      nominal,
      {
        ...measured([], []),
        rows,
        chrono: blankChrono,
        click: '0.1',
        dispersion: '0.2',
        system: presetUnits('metric-grams'),
      },
      english.t,
    )
    if (!('answer' in plan)) throw new Error(plan.problem)
    const lines = parameterLines(plan.answer.parameters, presetUnits('metric-grams'), english.t)
    expect(lines.filter((l) => l.status === 'identified')).toHaveLength(0)
    expect(lines.every((l) => l.value === undefined)).toBe(true)
  })
})

describe('plan', () => {
  it('shows which parameters a string of distances identifies, with standard errors', () => {
    const input = measured([300, 600, 900], [400, 700, 1000])
    const plan = planSession(nominal, input, english.t)
    if (!('answer' in plan)) throw new Error(plan.problem)
    const lines = parameterLines(plan.answer.parameters, system, english.t)
    expect(lines.map((l) => l.status)).toEqual(['identified', 'identified', 'identified'])
    expect(at(lines, 'muzzleVelocity').error).toMatch(/^±[\d.]+ %$/)
  })

  it('names the zero offset only when asked for', () => {
    const input = measured([300, 600, 900], [400, 700, 1000])
    const plan = planSession(nominal, { ...input, fitZeroOffset: true }, english.t)
    if (!('answer' in plan)) throw new Error(plan.problem)
    expect(plan.answer.parameters.map((p) => p.name)).toContain('zeroOffset')
  })
})

describe('entry problems', () => {
  const input = measured([300, 600, 900], [400, 700, 1000])

  it('names the row and the field that is missing', () => {
    const rows = input.rows.map((r, i) => (i === 1 ? { ...r, deviation: '' } : r))
    expect(fitSession(nominal, { ...input, rows }, english.t)).toEqual({
      problem: 'Row 2 deviation: enter a number.',
    })
  })

  it('rejects a deviation of 0 and a fraction of a shot', () => {
    const zero = input.rows.map((r, i) => (i === 0 ? { ...r, deviation: '0' } : r))
    expect(fitSession(nominal, { ...input, rows: zero }, english.t)).toEqual({
      problem: 'Row 1 deviation: must be greater than 0.',
    })
    const half = input.rows.map((r, i) => (i === 0 ? { ...r, shots: '2.5' } : r))
    expect(fitSession(nominal, { ...input, rows: half }, english.t)).toEqual({
      problem: 'Row 1 shots: enter a number.',
    })
  })

  it('leaves blank rows out', () => {
    const rows = [...input.rows, blankRow()]
    expect('answer' in fitSession(nominal, { ...input, rows }, english.t)).toBe(true)
  })

  it('gives the core refusal of an impact and a dial of one group', () => {
    const rows = [
      defined(input.rows[0]),
      { ...defined(input.rows[3]), range: defined(input.rows[0]).range },
      defined(input.rows[1]),
      defined(input.rows[4]),
    ]
    const answer = fitSession(nominal, { ...input, rows }, english.t)
    expect('problem' in answer).toBe(true)
  })

  it('needs a click value and a dispersion for the plan', () => {
    expect(planSession(nominal, { ...input, click: '' }, english.t)).toEqual({
      problem: 'Click value: enter a number.',
    })
    expect(planSession(nominal, { ...input, dispersion: '' }, english.t)).toEqual({
      problem: 'Dispersion of one shot: enter a number.',
    })
  })
})

describe('nominal line', () => {
  it('names the bullet, the muzzle velocity and the zero in the shown units', () => {
    expect(
      nominalLine(
        { bullet: 'G7 manual drag', muzzleVelocity: 790, zeroRange: 100 },
        system,
        english.t,
      ),
    ).toBe('G7 manual drag, 2592 ft/s, zero 109 yd')
  })
})

describe('a fit stored with a firearm configuration', () => {
  const input = measured([300, 600], [800])
  const fit = fitSession(nominal, input, english.t)
  if (!('answer' in fit)) throw new Error(fit.problem)
  const entry = truingEntry(
    { shot: nominal, bullet: 'Test bullet', zeroRange: 100 },
    input,
    fit.answer,
    new Date('2026-10-29T12:00:00Z'),
  )
  const record = {
    kind: 'firearm',
    id: 'f1',
    name: 'Rifle',
    saved: '2026-10-01T00:00:00.000Z',
    data: {
      origin: 'user',
      name: 'Rifle',
      twistHand: 'right',
      optics: [{ id: 'o1', kind: 'scope', name: 'Scope' }],
      configurations: [
        {
          id: 'c1',
          name: 'Scope',
          mounts: [{ optic: 'o1', sightHeight: { value: 50 }, zeroRange: { value: 100000 } }],
        },
      ],
    },
  }
  const now = new Date('2026-10-29T12:00:01Z')

  it('lists the strings it came from, in stored units', () => {
    const written = withTruing(record, 'c1', entry, now)
    if (written?.kind !== 'firearm') throw new Error('not stored')
    expect(written.saved).toBe(now.toISOString())
    const [stored] = defined(written.data.configurations[0]).truing ?? []
    expect(stored?.date).toBe('2026-10-29')
    expect(stored?.rows.map((r) => [r.kind, r.range.value, r.shots])).toEqual([
      ['impact', 300000, 5],
      ['impact', 600000, 5],
      ['dial', 800000, 5],
    ])
    const typed = defined(input.rows[0])
    expect(defined(stored?.rows[0]).mean).toEqual({
      value: expect.closeTo(system.lineOfSightOffset.toSi(Number(typed.mean)) * 1000, 6),
    })
    expect(defined(stored?.rows[2]).mean).toBe(Number(defined(input.rows[2]).mean))
    expect(stored?.chronograph?.shots).toBe(10)
    expect(truingSummary(defined(stored), system, english.t).strings).toContain('chronograph 10')
  })

  it('keeps a value only for an identified parameter', () => {
    for (const p of entry.parameters) expect(p.value !== undefined).toBe(p.status === 'identified')
  })

  it('stores nothing without the firearm or its configuration', () => {
    expect(withTruing(record, 'c9', entry, now)).toBeUndefined()
    expect(withTruing(undefined, 'c1', entry, now)).toBeUndefined()
  })
})
