import { subtendedAngle } from '@open-reloading/core'
import type { ShotGroup, TargetSheet } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { english } from '../src/i18n/translate.ts'
import { frameOf, rebase, targetToView } from '../src/lib/target-editor.ts'
import { notePlaceholders, resolveNote } from '../src/lib/target-notes.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined } from './defined.ts'

const metric = presetUnits('metric-grains')
const group = (x3: number): ShotGroup => ({
  id: 'g1',
  name: 'Step 2',
  colour: '#d9480f',
  distance: 100,
  shots: [
    { x: 0, y: 0, placement: 'placed' },
    { x: 0.01, y: 0, placement: 'placed' },
    { x: x3, y: 0.002, placement: 'placed' },
    { x: 0.5, y: 0.5, placement: 'placed', excluded: true },
  ],
})

describe('note placeholders', () => {
  it('show the current values after a shot moves', () => {
    const text = 'ES {extremeSpread.length}, {extremeSpread.moa}, {extremeSpread.mrad}'
    const before = resolveNote(text, group(0.004), metric, undefined, english.t)
    const after = resolveNote(text, group(0.02), metric, undefined, english.t)
    // ES 10.00 mm, then 20.10 mm between the first and the moved shot
    const es = Math.hypot(0.02, 0.002)
    const moa = (subtendedAngle(es, 100) * 180 * 60) / Math.PI
    expect(before).toMatch(/^ES 10\.00 mm, /)
    expect(after).toBe(
      `ES 20.10 mm, ${moa.toFixed(2)} MOA, ${(subtendedAngle(es, 100) * 1000).toFixed(2)} mrad`,
    )
  })

  it('name the group, its counts and distance; unknown tokens stay; missing values read n/a', () => {
    expect(
      resolveNote(
        '{name}: {shots} shots + {excluded} at {distance}',
        group(0.004),
        metric,
        undefined,
        english.t,
      ),
    ).toBe('Step 2: 3 shots + 1 at 100 m')
    expect(
      resolveNote('{nope} {extremeSpread.km} {name', group(0.004), metric, undefined, english.t),
    ).toBe('{nope} {extremeSpread.km} {name')
    expect(resolveNote('{name} {meanRadius.length}', undefined, metric, undefined, english.t)).toBe(
      'n/a n/a',
    )
    const one = { ...group(0), shots: [defined(group(0).shots[0])] }
    expect(resolveNote('{extremeSpread.moa}', one, metric, undefined, english.t)).toBe('n/a')
  })

  it('offer every readout in length, MOA and mrad in the picker', () => {
    const tokens = notePlaceholders.flatMap((p) => p.tokens.map((t) => t.token))
    expect(tokens).toContain('{extremeSpread.length}')
    expect(tokens).toContain('{cepElliptical.mrad}')
    expect(tokens).toContain('{name}')
    expect(new Set(tokens).size).toBe(tokens.length)
  })
})

describe('note values of two shots 10 mm apart at 100 m', () => {
  const two = (x2: number): ShotGroup => ({
    id: 'g1',
    name: 'Group 1',
    colour: '#d9480f',
    distance: 100,
    shots: [
      { x: 0, y: 0, placement: 'placed' },
      { x: x2, y: 0, placement: 'placed' },
    ],
  })
  const grams = presetUnits('metric-grams')

  it('the width in MOA follows the moved shot', () => {
    expect(resolveNote('Width {width.moa}', two(0.01), grams, undefined, english.t)).toBe(
      'Width 0.34 MOA',
    )
    expect(resolveNote('Width {width.moa}', two(0.02), grams, undefined, english.t)).toBe(
      'Width 0.69 MOA',
    )
  })
})

describe('notes keep their place on the photo', () => {
  it('a rotation moves a note with the shots', () => {
    const sheet: TargetSheet = {
      photo: 'p',
      references: [{ kind: 'line', a: { x: 0, y: 0 }, b: { x: 1000, y: 0 }, length: 0.1 }],
      targetRotation: 0,
      targetOrigin: { x: 500, y: 500 },
      groups: [],
      notes: [{ id: 'n1', x: 0.01, y: 0.02, text: 'a' }],
    }
    const turned = rebase(sheet, { ...sheet, targetRotation: 0.6 })
    const at = (s: TargetSheet) => {
      const f = frameOf(s)
      const n = s.notes?.[0]
      if (!f || !n) throw new Error('no frame')
      return targetToView(f, n)
    }
    expect(at(turned).x).toBeCloseTo(at(sheet).x, 9)
    expect(at(turned).y).toBeCloseTo(at(sheet).y, 9)
  })
})
