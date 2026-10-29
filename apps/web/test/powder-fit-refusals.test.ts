import {
  type ChronographString,
  type InteriorLoad,
  interior,
  type PowderFitOptions,
  type PowderParameter,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import type { PowderFitReply } from '../src/lib/powder-fit.ts'
import { answerPowderFit } from '../src/lib/powder-fit-answer.ts'

/** Synthetic rifle load of the core fit tests: truth vivacity 0.45 1/s, start pressure 30 MPa. */
const load = (vivacity: number): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

/** Standard normal numbers from a fixed seed (mulberry32, then Box-Muller). */
function normals(seed: number) {
  let a = seed >>> 0
  const u = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u())
}

/** Five shots per charge (g) at the truth's velocity with a shot SD of 4 m/s. */
function ladder(grams: number[], seed: number): ChronographString[] {
  const n = normals(seed)
  return grams.map((g) => {
    const r = interior({ ...load(0.45), charge: g / 1000 })
    if (!r.valid) throw new Error(r.reason)
    return {
      charge: g / 1000,
      velocities: Array.from(
        { length: 5 },
        () => Math.round((r.muzzleVelocity + 4 * n()) * 10) / 10,
      ),
    }
  })
}

const good = [2.6, 2.7, 2.81, 2.92, 3.04]

const answer = (
  strings: ChronographString[],
  extra: PowderParameter[],
  more: { anyway?: boolean; options?: PowderFitOptions } = {},
) => {
  const replies: PowderFitReply[] = []
  answerPowderFit(
    {
      id: 1,
      load: load(0.38),
      strings,
      options: { ...more.options, parameters: ['burnRate', ...extra] },
      anyway: more.anyway,
    },
    (r) => replies.push(r),
  )
  return replies
}

const fitted = (replies: PowderFitReply[]) => {
  const first = replies[0]
  if (first?.kind !== 'fit') throw new Error(`no fit: ${JSON.stringify(first)}`)
  return first
}

describe('refusals and rules of the tuning screen on the synthetic ladders', () => {
  it.each([
    {
      reason: 'underdetermined',
      strings: ladder([2.7, 2.9], 14),
      extra: ['startPressure', 'volumeFactor'] as PowderParameter[],
      anyway: true,
    },
    { reason: 'unresolved', strings: ladder(good, 15), extra: ['energy'] as PowderParameter[] },
    {
      reason: 'ill-conditioned',
      strings: ladder([2.7, 2.85, 2.97], 21),
      extra: ['startPressure', 'volumeFactor'] as PowderParameter[],
    },
    {
      reason: 'invalid',
      strings: [...ladder(good, 17), { charge: 3.5e-3, velocities: [900, 905, 898, 902, 901] }],
      extra: [] as PowderParameter[],
      charge: 3.5e-3,
    },
    {
      // the natural case needs 34 steps against the default 30 and converges on some platforms
      reason: 'not-converged',
      strings: ladder([2.8, 2.84, 2.88], 21),
      extra: ['startPressure'] as PowderParameter[],
      anyway: true,
      options: { maxIterations: 10 },
    },
  ])('refuses with $reason', ({ reason, strings, extra, anyway, options, charge }) => {
    const replies = answer(strings, extra, {
      ...(anyway ? { anyway } : {}),
      ...(options ? { options } : {}),
    })
    expect(replies).toEqual([{ kind: 'refused', id: 1, reason, charge }])
  })

  it('holds a start pressure that moves with the burn coefficient and fits the burn coefficient alone', () => {
    const replies = answer(ladder(good, 13), ['startPressure'])
    const fit = fitted(replies)
    expect(fit.rule).toBe('held')
    expect(fit.fit.parameters.map((p) => p.name)).toEqual(['burnRate'])
    expect(fit.fit.load.startPressure).toBe(30e6)
    expect(replies.map((r) => r.kind)).toEqual(['fit', 'range'])
  })

  it('fits the burn coefficient alone on a 2-charge ladder, and the values asked for anyway', () => {
    const strings = ladder([2.7, 2.9], 12)
    const thin = fitted(answer(strings, ['startPressure']))
    expect(thin.rule).toBe('thin')
    expect(thin.fit.parameters.map((p) => p.name)).toEqual(['burnRate'])
    const anyway = fitted(answer(strings, ['startPressure'], { anyway: true }))
    expect(anyway.rule).toBeUndefined()
    expect(anyway.fit.parameters.map((p) => p.name)).toEqual(['burnRate', 'startPressure'])
  })

  it('leaves the specific energy to the fit on a thin ladder', () => {
    expect(answer(ladder([2.7, 2.9], 12), ['energy'])).toEqual([
      { kind: 'refused', id: 1, reason: 'unresolved', charge: undefined },
    ])
  })

  it('applies no rule to a burn coefficient fitted alone on a thin ladder', () => {
    expect(fitted(answer(ladder([2.7, 2.9], 12), [])).rule).toBeUndefined()
  })
})
