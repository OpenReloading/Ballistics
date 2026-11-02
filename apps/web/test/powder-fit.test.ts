import {
  type ChronographString,
  fitPowder,
  interior,
  predictPowder,
  stringLadder,
} from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { load } from '../../../packages/core/test/powder-load.ts'
import { nth } from '../src/lib/nth.ts'
import type {
  HandPoint,
  PowderFitReply,
  PowderFitRequest,
  PowderFitState,
  PowderHandRequest,
} from '../src/lib/powder-fit.ts'
import { handCurveRunner, powderFitRunner } from '../src/lib/powder-fit.ts'
import { answerPowderFit, bandCharges } from '../src/lib/powder-fit-answer.ts'

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
        anyway: true,
      }),
    ).toEqual([{ kind: 'refused', id: 2, reason: 'underdetermined', charge: undefined }])
  })
})

/** A worker stand-in: keeps what it is sent, answers through `reply` and errors through `fail`. */
function fakeWorkers() {
  const made: {
    sent: PowderFitRequest[]
    ended: boolean
    reply: (r: PowderFitReply) => void
    fail: () => void
  }[] = []
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
      fail: () => w.onerror?.(),
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

  it('ends a worker that errors and runs the next request in a new one', () => {
    const { made, create } = fakeWorkers()
    let shown: PowderFitState = { running: false }
    const runner = powderFitRunner(create, (s) => {
      shown = s
    })
    runner.run({ load: load(), strings })
    made[0]?.fail()
    expect([made[0]?.ended, shown.failure?.kind, shown.running]).toEqual([true, 'error', false])
    runner.run({ load: load(), strings })
    expect(made).toHaveLength(2)
    expect(made[1]?.sent).toHaveLength(1)
    expect(shown.running).toBe(true)
  })
})

describe('hand curve runner', () => {
  const values = {} as Omit<PowderHandRequest, 'kind' | 'id'>
  const curve = (id: number, velocity: number) =>
    ({ kind: 'curve', id, curve: [{ charge: 2, velocity }] }) as unknown as PowderFitReply

  it('ends a worker that errors and sends the next request to a new one', () => {
    const { made, create } = fakeWorkers()
    let shown: HandPoint[] | undefined
    const runner = handCurveRunner(create, (c) => {
      shown = c
    })
    runner.ask(values)
    // a move while the first run is out waits for it
    runner.ask(values)
    expect(made[0]?.sent).toHaveLength(1)
    made[0]?.fail()
    expect(made[0]?.ended).toBe(true)
    expect(made).toHaveLength(2)
    expect(made[1]?.sent).toHaveLength(1)
    made[1]?.reply(curve(2, 800))
    expect(shown).toEqual([{ charge: 2, velocity: 800 }])
    runner.ask(values)
    expect(made).toHaveLength(2)
  })
})
