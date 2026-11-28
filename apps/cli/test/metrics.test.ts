import { describe, expect, it } from 'vitest'
import type { Outcome, Prediction } from '../src/evaluate.ts'
import { changeOf, evaluate, metricsOf } from '../src/metrics.ts'

const outcome = (bullet: string, velocity: number, prediction: Prediction): Outcome => ({
  index: 0,
  row: { line: 2, cartridge: 'c', bullet, powder: 'p', charge: 1, velocity },
  split: 'validation',
  family: 'f',
  construction: 'unknown',
  prediction,
})
const used = (bullet: string, velocity: number, predicted: number) =>
  outcome(bullet, velocity, { velocity: predicted, pressure: 3e8 })
const refused = outcome('b', 800, { reason: 'modelRefused' })

describe('metricsOf', () => {
  it('counts a printed velocity on the edge of the band as covered', () => {
    expect(metricsOf([used('b', 1100, 1000)], 0.1).interval).toEqual({ coverage: 1 })
  })

  it('gives the errors per barrel class, a handgun under 300 mm', () => {
    const at = (barrel: number, predicted: number, pressure?: number): Outcome => {
      const o = used('b', 1000, predicted)
      return { ...o, row: { ...o.row, barrel, pressure } }
    }
    const m = metricsOf([at(120, 1100, 2500), at(299, 1100), at(300, 1020), at(610, 1020)], null)
    expect(m.byBarrel).toEqual({
      handgun: {
        rows: 2,
        velocity: { median: expect.closeTo(0.1, 12), p90: expect.closeTo(0.1, 12) },
        pressure: { median: expect.closeTo(0.2, 12), p90: expect.closeTo(0.2, 12), rows: 1 },
      },
      rifle: {
        rows: 2,
        velocity: { median: expect.closeTo(0.02, 12), p90: expect.closeTo(0.02, 12) },
        pressure: null,
      },
    })
  })
})

describe('evaluate', () => {
  it('calibrates the interval on the used training rows only', () => {
    const training = used('b', 1000, 1100)
    const { interval } = evaluate(
      [],
      [{ ...training, row: { ...training.row, barrel: 610 } }, refused],
    )
    expect(interval).toEqual({
      basis: 'training',
      byBarrel: { rifle: { halfWidth: expect.closeTo(0.0909091, 6), trainingRows: 1 } },
      trainingRows: 1,
    })
  })

  it('calibrates one half width per barrel class on the distance the coverage tests', () => {
    const at = (barrel: number, predicted: number): Outcome => {
      const o = used('b', 1000, predicted)
      return { ...o, row: { ...o.row, barrel } }
    }
    const r = evaluate([at(120, 1090), at(610, 1030)], [at(120, 1100), at(610, 1020)])
    // |model - printed| / model: 100 / 1100 and 20 / 1020, not 0.10 and 0.02
    expect(r.interval).toEqual({
      basis: 'training',
      byBarrel: {
        handgun: { halfWidth: expect.closeTo(0.0909091, 6), trainingRows: 1 },
        rifle: { halfWidth: expect.closeTo(0.0196078, 6), trainingRows: 1 },
      },
      trainingRows: 2,
    })
    // the handgun row at 90 / 1090 is inside its class's band, the rifle row at 30 / 1030 outside
    expect(r.overall.interval).toEqual({ coverage: 0.5 })
  })

  it('gives no coverage to a group with a row of a class without training rows', () => {
    const at = (bullet: string, barrel: number, predicted: number): Outcome => {
      const o = used(bullet, 1000, predicted)
      return { ...o, row: { ...o.row, barrel } }
    }
    const r = evaluate(
      [at('b1', 120, 1000), at('b1', 610, 1000), at('b2', 610, 1000)],
      [at('b', 610, 1020)],
      'bullet',
    )
    expect(r.interval.byBarrel).not.toHaveProperty('handgun')
    expect(r.overall.interval).toBeNull()
    expect(r.grouped?.groups.b1?.interval).toBeNull()
    expect(r.grouped?.groups.b2?.interval).toEqual({ coverage: 1 })
  })

  it('groups by bullet', () => {
    const r = evaluate([used('b1', 800, 800), used('b2', 800, 800)], [], 'bullet')
    expect(Object.keys(r.grouped?.groups ?? {})).toEqual(['b1', 'b2'])
  })
})

describe('changeOf', () => {
  const none = metricsOf([refused], null)
  const some = metricsOf([used('b', 800, 880)], 0.2)

  it('gives the difference only where both sides have a value', () => {
    expect(changeOf(none, some)).toEqual({
      usedRows: 1,
      velocityMedian: null,
      velocityP90: null,
      pressureMedian: null,
      pressureP90: null,
      intervalCoverage: null,
    })
    expect(changeOf(some, none)).toMatchObject({ usedRows: -1, velocityMedian: null })
    expect(changeOf(some, some)).toMatchObject({ velocityMedian: 0, intervalCoverage: 0 })
  })

  it('takes a missing group as none', () => {
    expect(changeOf(undefined, some)).toMatchObject({ usedRows: 1, velocityMedian: null })
    expect(changeOf(some, undefined)).toMatchObject({ usedRows: -1, intervalCoverage: null })
  })
})
