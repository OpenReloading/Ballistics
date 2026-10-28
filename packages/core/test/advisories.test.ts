import { describe, expect, it } from 'vitest'
import {
  type AdvisoryId,
  advisoryIds,
  advisoryRule,
  advisoryRules,
  chargeTooSmallRatio,
  interior,
  interiorAdvisories,
} from '../src/index.ts'
import { m3Load } from './fixtures.ts'

const fired = (load: Parameters<typeof interiorAdvisories>[0]) =>
  interiorAdvisories(load).map((a) => a.id)
const withLoad = (over: Partial<typeof m3Load>) => ({ ...m3Load, ...over })
const ramp = (pressure: number) => ({ engraving: [{ travel: 0, pressure }] })

describe('advisory registry', () => {
  it('lists each code once with its fields', () => {
    const expected: Record<AdvisoryId, true> = {
      limitExceeded: true,
      noCartridge: true,
      noComparableLimit: true,
      rangeIncomplete: true,
      chargeTooSmall: true,
      resistanceNotApplied: true,
      loadRatioHigh: true,
      startPressureBelowResistance: true,
      gyrationRadiusWithoutTwist: true,
      startPressureHeldOnce: true,
    }
    expect(advisoryIds).toEqual(Object.keys(expected))
    expect(new Set(advisoryIds).size).toBe(advisoryRules.length)
    for (const r of advisoryRules) {
      expect(advisoryRule[r.id]).toBe(r)
      expect(r.inputs.length).toBeGreaterThan(0)
      expect(r.message).not.toMatch(/safe/i)
      expect(r.fix).not.toMatch(/safe/i)
    }
    expect(advisoryRule.chargeTooSmall.message).toContain(String(chargeTooSmallRatio))
  })
})

describe('start pressure at or below the resistance floor', () => {
  const id: AdvisoryId = 'startPressureBelowResistance'
  it('fires at and below the floor, friction and engraving at travel 0 together', () => {
    const resistance = { friction: 1e6, ...ramp(2e6) }
    expect(fired(withLoad({ resistance, startPressure: 3e6 + 1 }))).not.toContain(id)
    expect(fired(withLoad({ resistance, startPressure: 3e6 }))).toContain(id)
    expect(fired(withLoad({ resistance, startPressure: 1e6 }))).toContain(id)
  })
  it('does not fire above the floor, for no start pressure or without resistance', () => {
    expect(fired(withLoad({ resistance: { friction: 1e6 }, startPressure: 2e6 }))).not.toContain(id)
    expect(fired(withLoad({ startPressure: 0 }))).not.toContain(id)
    expect(fired(withLoad({ resistance: { friction: 1e6 }, startPressure: 0 }))).not.toContain(id)
  })
  it('counts an engraving that starts past travel 0 as no resistance at travel 0', () => {
    const resistance = { engraving: [{ travel: 0.001, pressure: 5e6 }] }
    expect(fired(withLoad({ resistance, startPressure: 1e6 }))).not.toContain(id)
  })
})

describe('gyration radius at zero twist', () => {
  const id: AdvisoryId = 'gyrationRadiusWithoutTwist'
  const radius = { mass: 0.0095, gyrationRadius: 0.002 }
  it('fires with a radius and a twist of 0', () => {
    expect(fired(withLoad({ bullet: radius }))).toContain(id)
  })
  it('does not fire with a twist, or without a radius', () => {
    expect(
      fired(withLoad({ bullet: radius, barrel: { length: 0.6, twist: 0.254 } })),
    ).not.toContain(id)
    expect(fired(m3Load)).not.toContain(id)
  })
})

describe('start pressure held once and resisted again', () => {
  const id: AdvisoryId = 'startPressureHeldOnce'
  it('fires above the floor with an engraving pressure at travel 0', () => {
    expect(fired(withLoad({ resistance: ramp(2e6), startPressure: 3e6 }))).toContain(id)
    expect(
      fired(withLoad({ resistance: { friction: 1e6, ...ramp(2e6) }, startPressure: 3e6 + 1 })),
    ).toContain(id)
  })
  it('does not fire at the floor, without engraving at travel 0 or with friction only', () => {
    expect(fired(withLoad({ resistance: ramp(2e6), startPressure: 2e6 }))).not.toContain(id)
    expect(fired(withLoad({ resistance: ramp(0), startPressure: 3e6 }))).not.toContain(id)
    expect(
      fired(
        withLoad({
          resistance: { engraving: [{ travel: 0.001, pressure: 2e6 }] },
          startPressure: 3e6,
        }),
      ),
    ).not.toContain(id)
    expect(fired(withLoad({ resistance: { friction: 1e6 }, startPressure: 3e6 }))).not.toContain(id)
  })
  it('does not fire when the ignition pressure reaches the start pressure', () => {
    const resistance = ramp(2e6)
    expect(fired(withLoad({ resistance, startPressure: 3e6, ignitionPressure: 2.9e6 }))).toContain(
      id,
    )
    expect(
      fired(withLoad({ resistance, startPressure: 3e6, ignitionPressure: 3e6 })),
    ).not.toContain(id)
    expect(
      fired(withLoad({ resistance, startPressure: 3e6, ignitionPressure: 4e6 })),
    ).not.toContain(id)
  })
  it('reads the friction as an input', () => {
    expect(advisoryRule[id].inputs).toEqual(
      expect.arrayContaining(['ignitionPressure', 'resistance.friction']),
    )
  })
})

describe('advisories never change a result', () => {
  it('leaves the load and the run as they are', () => {
    const load = withLoad({
      bullet: { mass: 0.0095, gyrationRadius: 0.002 },
      resistance: ramp(2e6),
      startPressure: 3e6,
    })
    const before = JSON.stringify(load)
    const first = interior(load)
    expect(fired(load)).toEqual(['gyrationRadiusWithoutTwist', 'startPressureHeldOnce'])
    expect(JSON.stringify(load)).toBe(before)
    expect(interior(load)).toEqual(first)
  })
})
