import { describe, expect, it } from 'vitest'
import { runKindOf, temperatureLadderBlockReason } from '../src/lib/seating-ladder.ts'

describe('runKindOf', () => {
  it('keeps seating', () => {
    expect(runKindOf('seating')).toBe('seating')
  })

  it('takes the charge for charge, temperature, anything else and no value', () => {
    expect(runKindOf('charge')).toBe('charge')
    expect(runKindOf('temperature')).toBe('charge')
    expect(runKindOf('Seating')).toBe('charge')
    expect(runKindOf('')).toBe('charge')
    expect(runKindOf(null)).toBe('charge')
    expect(runKindOf(undefined)).toBe('charge')
  })
})

describe('temperatureLadderBlockReason', () => {
  it('names the powder that has no temperature coefficient', () => {
    expect(temperatureLadderBlockReason('DP40')).toBe(
      'DP40 has no temperature coefficient, so the model cannot vary its burn rate with temperature.',
    )
  })

  it('says that no powder is chosen, and still gives a reason, without a powder', () => {
    expect(temperatureLadderBlockReason(undefined)).toContain('No powder is chosen.')
    expect(temperatureLadderBlockReason('')).toBe(temperatureLadderBlockReason(undefined))
  })
})
