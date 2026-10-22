import { describe, expect, it, vi } from 'vitest'
import { fitTruingStrings } from '../src/index.ts'
import type { LogFitInput } from '../src/least-squares.ts'

vi.mock('../src/least-squares.ts', async (original) => {
  const module = await original<typeof import('../src/least-squares.ts')>()
  return { ...module, logLeastSquares: vi.fn(module.logLeastSquares) }
})

import { logLeastSquares } from '../src/least-squares.ts'
import { click, nominal } from './range-strings-fixtures.ts'

// values near the nominal prediction are enough: the iteration is replaced in these tests
const input = {
  shot: nominal,
  clickValue: click,
  entries: [
    { kind: 'impact' as const, range: 300, value: -0.9, shotCount: 5, standardDeviation: 0.06 },
    { kind: 'impact' as const, range: 600, value: -6.8, shotCount: 5, standardDeviation: 0.12 },
    { kind: 'impact' as const, range: 900, value: -22, shotCount: 5, standardDeviation: 0.18 },
    { kind: 'dial' as const, range: 400, value: 20, shotCount: 5, standardDeviation: 2 },
    { kind: 'dial' as const, range: 700, value: 60, shotCount: 5, standardDeviation: 2 },
  ],
  chronograph: { mean: 790, shotCount: 10, standardDeviation: 4 },
}

/** Fails the first iteration with the reason and what the check found, then runs the real one. */
const failOnce = (
  reason: Parameters<LogFitInput['fail']>[0],
  extra: Parameters<LogFitInput['fail']>[2],
) => vi.mocked(logLeastSquares).mockImplementationOnce((fit) => fit.fail(reason, [0, 0, 0], extra))

describe('failures of the iteration', () => {
  it('drops the columns the check found without information and fits the rest', () => {
    failOnce('unresolved', { unresolved: [1] })
    const r = fitTruingStrings(input)
    expect(r.failures).toEqual([{ reason: 'unresolved', parameters: ['dragFactor'] }])
    const k = r.parameters[1]
    expect(k.status).toBe('unresolved')
    expect(k.reasons).toEqual(['fit-failed'])
    expect(k.value).toBeUndefined()
    expect(k.interval).toBeUndefined()
    expect(r.held).toEqual(['dragFactor'])
    // the others are fitted with the drag held: conditional on it, whatever the residuals say
    for (const p of [r.parameters[0], r.parameters[2]]) {
      expect(p.status).toBe('identified')
      expect(p.conditionalOn).toEqual(['dragFactor'])
      expect(p.intervalsTrusted).toBe(false)
    }
    expect(r.intervalsTrusted).toBe(false)
  })

  it('drops the parameters in the direction of the smallest eigenvalue when ill-conditioned', () => {
    failOnce('ill-conditioned', { conditionNumber: 5e3, direction: [0.7, 0.7, 0.1] })
    const r = fitTruingStrings(input)
    expect(r.failures).toEqual([
      { reason: 'ill-conditioned', parameters: ['muzzleVelocity', 'dragFactor'] },
    ])
    for (const p of r.parameters.slice(0, 2)) {
      expect(p.status).toBe('unresolved')
      expect(p.reasons).toEqual(['fit-failed'])
    }
    expect(r.held).toEqual(['muzzleVelocity', 'dragFactor'])
    expect(r.shot.muzzleVelocity).toBe(790)
    expect(r.parameters[2].conditionalOn).toEqual(['muzzleVelocity', 'dragFactor'])
  })

  it('drops every fitted parameter when the check names none', () => {
    failOnce('ill-conditioned', { conditionNumber: 5e3, direction: [0.1, 0.1, 0.1] })
    const r = fitTruingStrings(input)
    expect(r.failures[0].parameters).toEqual(['muzzleVelocity', 'dragFactor', 'clickValue'])
    expect(r.degreesOfFreedom).toBe(6)
    expect(r.parameters.every((p) => p.conditionalOn === undefined)).toBe(true)
  })
})
