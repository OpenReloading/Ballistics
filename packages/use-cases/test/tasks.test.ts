import { TruingError } from '@rangefoundry/ballistics'
import { InputError } from '@rangefoundry/statistics'
import { describe, expect, it } from 'vitest'
import { errorAnswer, replyTo, reviveError, serializeError, type Task } from '../src/index.ts'

const roundTrip = (e: unknown) => reviveError(structuredClone(serializeError(e)))

describe('errors across the thread boundary', () => {
  it('rebuilds TruingError, InputError with its typed refusal, and Error', () => {
    const truing = new TruingError('ill-conditioned', {
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
      detail: { code: 'rangeNotReached', params: { range: 500 } },
    })
    const t = roundTrip(truing)
    expect(t).toBeInstanceOf(TruingError)
    expect(t).toMatchObject({
      message: 'truing: ill-conditioned (rangeNotReached)',
      reason: 'ill-conditioned',
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
      detail: { code: 'rangeNotReached', params: { range: 500 } },
    })
    const input = roundTrip(new InputError('step limit'))
    expect(input).toBeInstanceOf(InputError)
    expect(input).not.toBeInstanceOf(TruingError)
    expect(input.message).toBe('step limit')
    const typed = roundTrip(new InputError({ code: 'matrix-size', params: { entries: 8 } }))
    expect(typed).toBeInstanceOf(InputError)
    expect(typed).toMatchObject({
      message: 'matrix-size',
      issue: { code: 'matrix-size', params: { entries: 8 } },
    })
    const range = roundTrip(new RangeError('Invalid array length'))
    expect(range).not.toBeInstanceOf(RangeError)
    expect(range.message).toBe('Invalid array length')
    // a thrown value that is not an Error arrives as an Error with its text
    const thrown = roundTrip('plain text')
    expect(thrown).toBeInstanceOf(Error)
    expect(thrown.message).toBe('plain text')
  })
})

describe('a task from a worker message', () => {
  it('runs only the kinds of the task table, not a name the table inherits', () => {
    // a message of another shape than Task
    const inherited = { kind: 'constructor' } as unknown as Task
    expect(replyTo(inherited)).toEqual({
      succeeded: false,
      error: { name: 'Error', message: 'unknown compute task kind constructor' },
    })
  })
})

describe('the answer of a typed refusal', () => {
  it('writes a param number that JSON cannot hold as JavaScript writes it', () => {
    const error = new InputError({ code: 'pressureInvalid', params: { pressure: Infinity } })
    const answer = errorAnswer(error, { withNotice: false, truingDetails: false })
    expect(answer?.body).toMatchObject({
      code: 'pressureInvalid',
      params: { pressure: 'Infinity' },
    })
  })
})
