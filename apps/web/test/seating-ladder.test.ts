import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  ladderTitle,
  runKindOf,
  temperatureLadder,
  temperatureLadderBlockReason,
} from '../src/lib/seating-ladder.ts'

describe('runKindOf', () => {
  it('keeps seating and temperature', () => {
    expect(runKindOf('seating')).toBe('seating')
    expect(runKindOf('temperature')).toBe('temperature')
  })

  it('takes the charge for charge, anything else and no value', () => {
    expect(runKindOf('charge')).toBe('charge')
    expect(runKindOf('Seating')).toBe('charge')
    expect(runKindOf('')).toBe('charge')
    expect(runKindOf(null)).toBe('charge')
    expect(runKindOf(undefined)).toBe('charge')
  })
})

describe('ladderTitle', () => {
  it('names each kind', () => {
    expect(
      ['charge', 'seating', 'temperature'].map((k) => ladderTitle(runKindOf(k), english.t)),
    ).toEqual(['Charge', 'Seating', 'Temperature'])
  })
})

describe('temperatureLadderBlockReason', () => {
  it('is none for a powder with a temperature sensitivity', () => {
    expect(temperatureLadderBlockReason('DP40', true, english.t)).toBeUndefined()
  })

  it('names the powder that has no temperature sensitivity', () => {
    expect(temperatureLadderBlockReason('DP40', false, english.t)).toBe(
      'DP40 has no temperature sensitivity, so the model cannot vary its burn rate with temperature.',
    )
  })

  it('says that no powder is chosen, and still gives a reason, without a powder', () => {
    expect(temperatureLadderBlockReason(undefined, false, english.t)).toContain(
      'No powder is chosen.',
    )
    expect(temperatureLadderBlockReason('', false, english.t)).toBe(
      temperatureLadderBlockReason(undefined, false, english.t),
    )
  })
})

describe('temperatureLadder', () => {
  const show = (k: number) => `${k} K`

  it('steps up, down and around the start, lowest first', () => {
    expect(temperatureLadder(293.15, 10, 3, 'up', show, english.t)).toEqual({
      steps: [293.15, 303.15, 313.15],
    })
    expect(temperatureLadder(293.15, 10, 3, 'down', show, english.t)).toEqual({
      steps: [293.15, 283.15, 273.15],
    })
    expect(temperatureLadder(293.15, 10, 3, 'around', show, english.t)).toEqual({
      steps: [283.15, 293.15, 303.15],
    })
  })

  it('needs the start temperature', () => {
    expect(temperatureLadder(undefined, 10, 3, 'up', show, english.t)).toEqual({
      error: 'Powder temperature is empty: the temperature ladder starts from it.',
    })
  })

  it('stops at a step that reaches 0 K or less and names the temperature', () => {
    expect(temperatureLadder(20, 10, 3, 'down', show, english.t)).toEqual({
      error: 'The ladder reaches 0 K: a temperature of 0 K or less is no state.',
    })
  })
})
