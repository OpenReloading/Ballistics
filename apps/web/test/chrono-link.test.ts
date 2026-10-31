import type { GroupShot, SessionRecord } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { linkedString, linkString, stringChoices } from '../src/lib/chrono-link.ts'
import { nth } from '../src/lib/nth.ts'

const session = {
  kind: 'session',
  id: 's1',
  name: 'Range day',
  saved: '2026-10-31T00:00:00.000Z',
  data: {
    origin: 'user',
    device: { kind: 'other' },
    strings: [
      { shots: [{ velocity: { value: 800 } }, { velocity: { value: 801 } }] },
      {
        shots: [
          { velocity: { value: 810 } },
          { velocity: { value: 811 } },
          { velocity: { value: 812 } },
        ],
      },
    ],
    provenance: { kind: 'measured', sources: [{ title: 'file' }] },
  },
} as unknown as SessionRecord

const shot = (x: number, excluded?: boolean): GroupShot => ({
  x,
  y: 0,
  placement: 'placed',
  ...(excluded && { excluded }),
})

describe('linkString', () => {
  const [, second] = stringChoices([session])

  it('links the included shots to the string in order and skips an excluded shot', () => {
    const linked = linkString([shot(0), shot(1, true), shot(2), shot(3)], second)
    expect(linked.map((s) => s.chrono?.shot)).toEqual([0, undefined, 1, 2])
    expect(nth(linked, 0).chrono).toEqual({ session: 'user:s1', string: 1, shot: 0 })
  })

  it('leaves the shots past the end of the string without a link', () => {
    const linked = linkString([shot(0), shot(1), shot(2)], nth(stringChoices([session]), 0))
    expect(linked.map((s) => s.chrono?.shot)).toEqual([0, 1, undefined])
  })

  it('replaces earlier links and removes every link without a choice', () => {
    const once = linkString([shot(0), shot(1)], second)
    expect(linkString(once, nth(stringChoices([session]), 0)).map((s) => s.chrono?.string)).toEqual(
      [0, 0],
    )
    expect(linkString(once).some((s) => s.chrono)).toBe(false)
  })

  it('reads the string of the first linked shot', () => {
    expect(linkedString([shot(0)])).toBeUndefined()
    expect(linkedString(linkString([shot(0, true), shot(1)], second))).toEqual({
      session: 'user:s1',
      string: 1,
      shot: 0,
    })
  })
})
