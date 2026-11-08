import { TruingError } from '@open-reloading/ballistics'
import { InputError } from '@open-reloading/statistics'
import { describe, expect, it } from 'vitest'
import { reviveError, serializeError } from '../src/index.ts'

const roundTrip = (e: unknown) => reviveError(structuredClone(serializeError(e)))

describe('errors across the thread boundary', () => {
  it('rebuilds TruingError, InputError with its typed refusal, and Error', () => {
    const truing = new TruingError('ill-conditioned', {
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
      detail: 'step limit',
    })
    const t = roundTrip(truing)
    expect(t).toBeInstanceOf(TruingError)
    expect(t).toMatchObject({
      message: 'truing: ill-conditioned (step limit)',
      reason: 'ill-conditioned',
      conditionNumber: Number.POSITIVE_INFINITY,
      unresolved: [1],
      direction: [0.6, 0.8],
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
