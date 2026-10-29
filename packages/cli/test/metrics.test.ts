import { describe, expect, it } from 'vitest'
import type { Outcome, Prediction } from '../src/evaluate.ts'
import { changeOf, evaluate, metricsOf } from '../src/metrics.ts'

const outcome = (bullet: string, velocity: number, prediction: Prediction): Outcome => ({
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
})

describe('evaluate', () => {
  it('calibrates the interval on the used training rows only', () => {
    const { interval } = evaluate([], [used('b', 1000, 1100), refused])
    expect(interval).toEqual({
      basis: 'training',
      halfWidth: expect.closeTo(0.1, 12),
      trainingRows: 1,
    })
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
