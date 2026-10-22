import { describe, expect, it } from 'vitest'
import { fieldError } from '../src/lib/field-spec.ts'
import { livePick, pickedSystem, pickedText, pickedTyped, pickUnit } from '../src/lib/field-unit.ts'
import { metersPerInch, presetUnits, resolveUnits } from '../src/lib/units.ts'

const metric = presetUnits('metric-grams')

describe('a field unit pick', () => {
  it('is none for the page unit itself and for an unknown unit', () => {
    expect(pickUnit('length', metric, 'mm')).toBeUndefined()
    expect(pickUnit('length', metric, 'cubit')).toBeUndefined()
  })

  it('swaps one quantity of the page units and leaves the others', () => {
    const pick = pickUnit('length', metric, 'in')
    const shown = pickedSystem('length', metric, pick)
    expect(shown.length.symbol).toBe('in')
    expect(shown.mass).toBe(metric.mass)
    expect(metric.length.symbol).toBe('mm')
  })

  it('is dropped when the page units change', () => {
    const pick = pickUnit('length', metric, 'in')
    const same = resolveUnits({ preset: 'metric-grams', overrides: {} })
    expect(pickedSystem('length', same, pick)).toBe(same)
    const us = resolveUnits({ preset: 'us', overrides: {} })
    expect(pickedSystem('length', us, pick)).toBe(us)
    expect(pickedSystem('length', metric, undefined)).toBe(metric)
  })

  it('is not revived when the same page units return after others', () => {
    const us = resolveUnits({ preset: 'us', overrides: {} })
    let state = pickUnit('length', metric, 'in')
    state = livePick(state, us)
    state = livePick(state, metric)
    expect(state).toBeUndefined()
    expect(pickedSystem('length', metric, state)).toBe(metric)
    expect(livePick(pickUnit('length', metric, 'in'), metric)).toEqual({ id: 'in', system: metric })
  })

  it('shows the SI value in the picked unit and the typed text while the value is unchanged', () => {
    const pick = pickUnit('length', metric, 'in')
    const shown = pickedSystem('length', metric, pick)
    expect(pickedText('length', shown, { text: '25.4', si: 0.0254 }, pick)).toBe('1')
    const next = pickedTyped('length', metric, shown, '1.50')
    expect(next.value.si).toBeCloseTo(1.5 * metersPerInch, 12)
    // the form keeps text for the page unit: 38.1 mm
    expect(next.value.text).toBe('38.1')
    const withTyped = { id: 'in', system: metric, typed: next.typed }
    expect(pickedText('length', shown, next.value, withTyped)).toBe('1.50')
    expect(pickedText('length', shown, { text: '12', si: 0.012 }, withTyped)).toBe('0.4724')
  })

  it('keeps invalid and empty text as typed, with no SI value', () => {
    const shown = pickedSystem('length', metric, pickUnit('length', metric, 'in'))
    expect(pickedTyped('length', metric, shown, 'x')).toEqual({
      value: { text: 'x', si: undefined },
    })
    expect(pickedTyped('length', metric, shown, '')).toEqual({ value: { text: '', si: undefined } })
    expect(pickedText('length', shown, { text: 'x', si: undefined }, undefined)).toBe('x')
  })

  it('reads a twist as 1:N in the picked unit', () => {
    const pick = pickUnit('twist', metric, 'in')
    const shown = pickedSystem('twist', metric, pick)
    const next = pickedTyped('twist', metric, shown, '1 in 10')
    expect(next.value.si).toBeCloseTo(10 * metersPerInch, 12)
    expect(next.value.text).toBe('1:254')
    expect(pickedText('twist', shown, { text: '1:254', si: 0.254 }, pick)).toBe('1:10')
  })
})

describe('a validation message of a field with its own unit', () => {
  const mass = { key: 'mass', label: 'Mass', quantity: 'mass', min: 0, positive: true } as const
  const us = presetUnits('us')
  const grains = presetUnits('metric-grains')

  it('names the unit the field shows, not the page unit', () => {
    const toG = pickedSystem('mass', us, pickUnit('mass', us, 'g'))
    expect(fieldError(mass, pickedTyped('mass', us, toG, '0').value, toG)).toBe(
      'Mass must be greater than 0 g.',
    )
    expect(fieldError(mass, pickedTyped('mass', us, toG, '0').value, us)).toBe(
      'Mass must be greater than 0 gr.',
    )
    const toGr = pickedSystem('mass', metric, pickUnit('mass', metric, 'gr'))
    expect(fieldError(mass, pickedTyped('mass', metric, toGr, '0').value, toGr)).toBe(
      'Mass must be greater than 0 gr.',
    )
    expect(fieldError(mass, pickedTyped('mass', grains, toGr, '-1').value, grains)).toBe(
      'Mass must be at least 0 gr.',
    )
  })

  it('names the picked length unit of a bound', () => {
    const length = { key: 'l', label: 'Length', quantity: 'length', min: 0 } as const
    const toIn = pickedSystem('length', metric, pickUnit('length', metric, 'in'))
    expect(fieldError(length, pickedTyped('length', metric, toIn, '-1').value, toIn)).toBe(
      'Length must be at least 0 in.',
    )
  })
})
