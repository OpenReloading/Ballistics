import type { Powder } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import {
  approximateVolumeTolerance,
  followPlan,
  noCoefficientOf,
  seatingOwnsVolume,
} from '../src/components/use-workbench-load.ts'

const plan = (
  values: Parameters<typeof followPlan>[0],
  now: Parameters<typeof followPlan>[1],
  previewed: Partial<Record<'volume' | 'travel', number>>,
) =>
  followPlan(values, now, {
    followed: new Set(),
    written: {},
    previewed,
    field: (_k, v) => ({ text: String(v), si: v }),
  })

const seated = 3.5e-6
const report = { caseVolume: 4e-6, overallLength: 0.07 }

it('empties a volume that followed a seating once the bullet seats without one', () => {
  const now = { volume: { text: '3.5', si: seated } }
  const { next, following } = plan(report, now, { volume: seated })
  expect(next.volume).toEqual({ text: '', si: undefined })
  expect(following.volume).toBeUndefined()
})

it('keeps a typed volume when the bullet seats without one', () => {
  const now = { volume: { text: '3.2', si: 3.2e-6 } }
  expect(plan(report, now, { volume: seated }).next).toEqual({})
})

it('keeps a followed volume while the case volume is not known yet', () => {
  const now = { volume: { text: '3.5', si: seated } }
  expect(plan({ overallLength: 0.07 }, now, { volume: seated }).next).toEqual({})
})

it('fills the volume again when the seating gives one', () => {
  const now = { volume: { text: '', si: undefined } }
  const { next, following } = plan({ ...report, volume: seated }, now, {})
  expect(next.volume?.si).toBe(seated)
  expect(following.volume).toBe(seated)
})

it('keeps the case volume default out of a seating without a volume behind the bullet', () => {
  expect(seatingOwnsVolume({ ...report, volume: seated })).toBe(true)
  expect(seatingOwnsVolume(report)).toBe(true)
  // no seating: the case volume default fills the field
  expect(seatingOwnsVolume({ caseVolume: 4e-6 })).toBe(false)
  expect(seatingOwnsVolume({})).toBe(false)
})

const powder = (extra: object) =>
  ({ id: 'p', interior: { propellantTemperature: { value: 21 } }, ...extra }) as unknown as Powder

it('gives the temperature of the fit for a powder with a model and no temperature coefficient', () => {
  expect(noCoefficientOf(powder({}))?.noCoefficient.reference).toBeCloseTo(294.15, 9)
  expect(noCoefficientOf(powder({ temperatureSensitivity: {} }))).toBeUndefined()
  expect(noCoefficientOf({ id: 'p' } as Powder)).toBeUndefined()
  expect(noCoefficientOf(undefined)).toBeUndefined()
})

it('hands the interval of an approximate volume to the run while the field still holds it', () => {
  const volume = { si: 3e-6, source: '', approximate: true as const, halfWidth: 0.12 }
  const following = new Set(['volume'] as const)
  expect(approximateVolumeTolerance(volume, 3e-6, following)).toBe(0.12)
  // a typed value, a field that no longer follows and a measured volume give no tolerance
  expect(approximateVolumeTolerance(volume, 3.1e-6, following)).toBeUndefined()
  expect(approximateVolumeTolerance(volume, 3e-6, new Set())).toBeUndefined()
  expect(approximateVolumeTolerance({ si: 3e-6, source: '' }, 3e-6, following)).toBeUndefined()
  // the API takes at most 0.2
  expect(approximateVolumeTolerance({ ...volume, halfWidth: 0.5 }, 3e-6, following)).toBe(0.2)
})
