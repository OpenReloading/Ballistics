import { expect, it } from 'vitest'
import { followPlan, seatingOwnsVolume } from '../src/components/use-workbench-load.ts'

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
