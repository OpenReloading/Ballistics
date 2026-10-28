import {
  type ChronographString,
  fitPowder,
  type InteriorLoad,
  interior,
  predictPowder,
  stringLadder,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { nth } from '../src/lib/nth.ts'
import type { PowderFitReply, PowderFitRequest, PowderFitState } from '../src/lib/powder-fit.ts'
import { powderFitRunner } from '../src/lib/powder-fit.ts'
import { answerPowderFit, bandCharges } from '../src/lib/powder-fit-answer.ts'

/** Synthetic rifle load of the core fit tests: truth vivacity 0.45 1/s. */
const load = (vivacity = 0.45): InteriorLoad => ({
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

const strings: ChronographString[] = [2.6e-3, 2.7e-3, 2.8e-3, 2.9e-3].map((charge, i) => {
  const r = interior({ ...load(), charge })
  if (!r.valid) throw new Error(r.reason)
  const v = r.muzzleVelocity + nth([1.5, -2, 0.5, 1], i)
  return { charge, velocities: [v - 3, v, v + 3] }
})

const answer = (q: PowderFitRequest) => {
  const replies: PowderFitReply[] = []
  answerPowderFit(q, (r) => replies.push(r))
  return replies
}

describe('powder fit in a worker', () => {
  it('answers with the fit of fitPowder and its band first, then the range and label', () => {
    const replies = answer({ id: 1, load: load(0.38), strings })
    expect(replies.map((r) => r.kind)).toEqual(['fit', 'range'])
    const [first, second] = replies
    if (first?.kind !== 'fit' || second?.kind !== 'range') throw new Error('unexpected order')
    const fit = fitPowder(load(0.38), stringLadder(strings))
    expect(first.fit.parameters).toStrictEqual(fit.parameters)
    expect(first.fit.residuals).toStrictEqual(fit.residuals)
    expect(structuredClone(first.fit)).toStrictEqual(fit)
    const charges = bandCharges(fit.chargeRange)
    expect(structuredClone(first.band)).toStrictEqual(charges.map((c) => predictPowder(fit, c)))
    expect(second.confidence.label).toMatch(/tight|moderate|loose/)
  }, 60_000)

  it('names the reason of a refused fit', () => {
    const one = strings.slice(0, 1)
    expect(
      answer({
        id: 2,
        load: load(),
        strings: one,
        options: { parameters: ['burnRate', 'startPressure'] },
      }),
    ).toEqual([{ kind: 'refused', id: 2, reason: 'underdetermined', charge: undefined }])
  })
})

/** A worker stand-in: keeps what it is sent and answers through `reply`. */
function fakeWorkers() {
  const made: { sent: PowderFitRequest[]; ended: boolean; reply: (r: PowderFitReply) => void }[] =
    []
  const create = () => {
    const w = {
      sent: [] as PowderFitRequest[],
      ended: false,
      onmessage: undefined as ((e: MessageEvent<PowderFitReply>) => void) | undefined,
      onerror: undefined as (() => void) | undefined,
      postMessage(q: PowderFitRequest) {
        this.sent.push(q)
      },
      terminate() {
        this.ended = true
      },
    }
    made.push({
      get sent() {
        return w.sent
      },
      get ended() {
        return w.ended
      },
      reply: (r) => w.onmessage?.({ data: r } as MessageEvent<PowderFitReply>),
    })
    return w as unknown as Worker
  }
  return { made, create }
}

describe('powder fit runner', () => {
  const fitReply = (id: number) =>
    ({ kind: 'fit', id, fit: {}, band: [] }) as unknown as PowderFitReply
  const rangeReply = (id: number) =>
    ({ kind: 'range', id, range: {}, confidence: {} }) as unknown as PowderFitReply

  it('shows only the answer to the second of two quick edits', () => {
    const { made, create } = fakeWorkers()
    const shown: PowderFitState[] = []
    const runner = powderFitRunner(create, (s) => shown.push(s))
    runner.run({ load: load(), strings })
    runner.run({ load: load(), strings: strings.slice(1) })
    const [a, b] = made
    expect(a?.ended).toBe(true)
    // a late reply of the ended worker is not shown
    a?.reply(fitReply(1))
    b?.reply(fitReply(2))
    b?.reply(rangeReply(2))
    expect(b?.sent.map((q) => q.strings.length)).toEqual([3])
    expect(shown.map((s) => [s.fit?.id, s.range?.id, s.running])).toEqual([
      [undefined, undefined, true],
      [undefined, undefined, true],
      [2, undefined, true],
      [2, 2, false],
    ])
  })

  it('shows the fit before the range, and keeps the worker between finished requests', () => {
    const { made, create } = fakeWorkers()
    let shown: PowderFitState = { running: false }
    const runner = powderFitRunner(create, (s) => {
      shown = s
    })
    runner.run({ load: load(), strings })
    made[0]?.reply(fitReply(1))
    expect(shown.fit && !shown.range && shown.running).toBe(true)
    made[0]?.reply(rangeReply(1))
    expect(shown.range && !shown.running).toBe(true)
    runner.run({ load: load(), strings })
    expect(made).toHaveLength(1)
  })
  it('keeps the fit on screen when the range fails after it', () => {
    const { made, create } = fakeWorkers()
    let shown: PowderFitState = { running: false }
    const runner = powderFitRunner(create, (s) => {
      shown = s
    })
    runner.run({ load: load(), strings })
    made[0]?.reply(fitReply(1))
    made[0]?.reply({ kind: 'error', id: 1, message: 'failed' })
    expect([shown.fit?.id, shown.failure?.kind, shown.running]).toEqual([1, 'error', false])
  })
})
