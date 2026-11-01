import { expect, it, vi } from 'vitest'
import { resetToRecord } from '../src/components/record-reset.ts'
import { changedFromRecord, recordValuesOf } from '../src/lib/record-changes.ts'
import { presetUnits } from '../src/lib/units.ts'

it('names the values a record gives that the user changed, with the record value', () => {
  const changed = changedFromRecord(
    { vivacity: 2, gamma: 1.24, boreDiameter: 0.0078, density: undefined },
    { vivacity: 1.8, gamma: 1.24, boreDiameter: 0.00782, density: 1600, covolume: 0.001 },
    new Set(['boreDiameter']),
  )
  // equal, given by a record, empty and without a record value: no change
  expect(changed).toEqual({ vivacity: 1.8 })
})

it('takes a value equal to the record value but for a unit round trip as unchanged', () => {
  expect(changedFromRecord({ gamma: 1.24 + 1e-12 }, { gamma: 1.24 }, new Set())).toEqual({})
})

it('leaves the volume to the seating while a bullet is seated, and takes the gun weight', () => {
  const suggestions = {
    volume: { si: 3e-6, source: 'x' },
    boreDiameter: { si: 0.0078, source: 'y' },
  }
  const base = { origin: undefined, bullet: {}, specs: {}, suggestions, firearmMass: 3.2 }
  expect(recordValuesOf({ ...base, seatingOwnsVolume: false })).toMatchObject({
    volume: 3e-6,
    boreDiameter: 0.0078,
    firearmMass: 3.2,
  })
  expect(recordValuesOf({ ...base, seatingOwnsVolume: true }).volume).toBeUndefined()
})

it('resets each kind of value its own way and counts the resets', () => {
  const targets = {
    changes: {
      vivacity: 1.8,
      boreDiameter: 0.0078,
      bulletLength: 0.03,
      firearmMass: 3.2,
      pmax: 3.5e7,
    },
    system: presetUnits('metric-grams'),
    bulletKeys: new Set(['bulletLength']),
    specKeys: new Set(['pmax']),
    baseChanged: false,
    setField: vi.fn(),
    clearError: vi.fn(),
    unsetTypedBullet: vi.fn(),
    unsetTypedSpec: vi.fn(),
    follow: vi.fn(),
    setGunWeight: vi.fn(),
  }
  const n = resetToRecord(
    ['vivacity', 'boreDiameter', 'bulletLength', 'firearmMass', 'gamma', 'pmax'],
    targets,
  )
  expect(n).toBe(5)
  expect(targets.unsetTypedSpec).toHaveBeenCalledWith(['pmax'])
  expect(targets.unsetTypedBullet).toHaveBeenCalledWith(['bulletLength'])
  expect(targets.follow).toHaveBeenCalledWith(['boreDiameter'])
  expect(targets.setField).toHaveBeenCalledWith('boreDiameter', { text: '', si: undefined })
  expect(targets.setField).toHaveBeenCalledWith('vivacity', { text: expect.any(String), si: 1.8 })
  expect(targets.setGunWeight).toHaveBeenCalledWith({ text: expect.any(String), si: 3.2 })
})

it('resets a changed base form with the base dimensions typed for it', () => {
  const targets = {
    changes: { bulletLength: 0.03 },
    system: presetUnits('metric-grams'),
    bulletKeys: new Set(['bulletLength']),
    specKeys: new Set(['pmax']),
    baseChanged: true,
    setField: vi.fn(),
    clearError: vi.fn(),
    unsetTypedBullet: vi.fn(),
    unsetTypedSpec: vi.fn(),
    follow: vi.fn(),
    setGunWeight: vi.fn(),
  }
  expect(resetToRecord(['bulletBase'], targets)).toBe(1)
  expect(targets.unsetTypedBullet).toHaveBeenCalledWith([
    'bulletBase',
    'bulletBaseLength',
    'bulletBaseDiameter',
    'bulletCavityDiameter',
    'bulletCavityDepth',
  ])
  // a base form equal to the record's is nothing to reset
  const same = { ...targets, baseChanged: false, unsetTypedBullet: vi.fn() }
  expect(resetToRecord(['bulletBase'], same)).toBe(0)
  expect(same.unsetTypedBullet).not.toHaveBeenCalled()
})
