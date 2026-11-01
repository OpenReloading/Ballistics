import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import {
  runKindOf,
  type SeatingLengths,
  seatingLadder,
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

describe('seatingLadder', () => {
  const show = (m: number) => `${(m * 1000).toFixed(2)} mm`
  // a bullet seated 1 mm deeper takes 1 mm of bore area 30 mm2 from the case and adds 1 mm of travel
  const seat = (over: Partial<SeatingLengths> = {}): SeatingLengths => ({
    lengthKind: 'overallLength',
    range: [0.07, 0.072],
    at: (v) => ({ volume: 3.5e-6 + 30e-6 * (v - 0.071), travel: 0.6 - v }),
    ...over,
  })

  it('gives the volume and travel at each length, around the start', () => {
    const r = seatingLadder(seat(), 0.071, 0.0005, 3, 'around', show, english.t)
    if (!('steps' in r)) throw new Error(r.error)
    expect(r.steps.map((s) => s.value)).toEqual(
      [0.0705, 0.071, 0.0715].map((v) => expect.closeTo(v, 12)),
    )
    expect(r.steps[0]?.volume).toBeCloseTo(3.5e-6 - 15e-9, 15)
    expect(r.steps[2]?.travel).toBeCloseTo(0.5285, 12)
  })

  it('carries the jump of each step, for the engraving ramp of its run', () => {
    const jumping = seat({ at: (v) => ({ volume: 3.5e-6, travel: 0.5, jump: 0.0712 - v }) })
    const r = seatingLadder(jumping, 0.071, 0.0005, 2, 'up', show, english.t)
    if (!('steps' in r)) throw new Error(r.error)
    expect(r.steps.map((s) => s.jump)).toEqual([0.0002, -0.0003].map((v) => expect.closeTo(v, 12)))
  })

  it("carries each step's cavity bracket of a hollow base", () => {
    const hollow = seat({
      at: (v) => ({
        volume: 3.5e-6 + 30e-6 * (v - 0.071),
        travel: 0.6 - v,
        cavityRange: { low: v * 1e-5, high: v * 2e-5 },
      }),
    })
    const r = seatingLadder(hollow, 0.071, 0.0005, 2, 'up', show, english.t)
    if (!('steps' in r)) throw new Error(r.error)
    expect(r.steps.map((s) => s.cavityRange?.low)).toEqual(
      [0.071e-5, 0.0715e-5].map((v) => expect.closeTo(v, 15)),
    )
    const plain = seatingLadder(seat(), 0.071, 0.0005, 1, 'up', show, english.t)
    expect('steps' in plain && plain.steps[0]).not.toHaveProperty('cavityRange')
  })

  it('names the empty length it starts from, CBTO for a bullet seated by its ogive', () => {
    expect(
      seatingLadder(
        seat({ lengthKind: 'baseToOgive' }),
        undefined,
        0.0005,
        3,
        'up',
        show,
        english.t,
      ),
    ).toEqual({ error: 'CBTO is empty: the seating ladder starts from it.' })
  })

  it('takes a step on either end of the range, and refuses one past it in the unit shown', () => {
    expect('steps' in seatingLadder(seat(), 0.071, 0.0005, 3, 'up', show, english.t)).toBe(true)
    expect('steps' in seatingLadder(seat(), 0.0705, 0.0005, 2, 'down', show, english.t)).toBe(true)
    expect(seatingLadder(seat(), 0.071, 0.0005, 4, 'up', show, english.t)).toEqual({
      error:
        'COAL 71.00 mm to 72.50 mm is outside the seating range 70.00 mm to 72.00 mm of this cartridge and bullet.',
    })
    expect(seatingLadder(seat(), 0.0705, 0.0005, 3, 'down', show, english.t)).toEqual({
      error:
        'COAL 69.50 mm to 70.50 mm is outside the seating range 70.00 mm to 72.00 mm of this cartridge and bullet.',
    })
  })

  it('needs the case capacity and barrel length behind each step', () => {
    expect(
      seatingLadder(seat({ at: () => ({}) }), 0.071, 0.0005, 1, 'up', show, english.t),
    ).toEqual({ error: 'The seating ladder needs a case capacity and a barrel length.' })
  })

  it('stops at the step where no case volume is left behind the bullet', () => {
    const shallow = seat({ at: (v) => ({ volume: v < 0.0702 ? 0 : 1e-6, travel: 0.5 }) })
    expect(seatingLadder(shallow, 0.071, 0.0005, 3, 'down', show, english.t)).toEqual({
      error: 'The case volume behind the bullet is 0 or less at COAL 70.00 mm.',
    })
  })
})
