import type { Powder } from '@open-reloading/schema'
import { expect, it } from 'vitest'
import {
  approximateVolumeTolerance,
  followPlan,
  noCoefficientOf,
  runSeatingOf,
  runVolumeTolerance,
  seatingOwnsVolume,
  typedOverSeating,
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

it('blocks a seating ladder only on a volume or travel typed over the seating it followed (#938)', () => {
  const arrived = { volume: 3.6e-6, travel: 0.53, overallLength: 0.071 }
  const fields = { volume: { si: 3.6e-6 }, travel: { si: 0.53 } }
  // the seating, the fields and what they followed read at once: nothing typed
  expect(typedOverSeating(arrived, fields, { volume: 3.6e-6, travel: 0.53 })).toEqual([])
  expect(typedOverSeating(arrived, { ...fields, travel: { si: 0.5 } }, arrived)).toEqual(['travel'])
  expect(typedOverSeating({}, { volume: { si: 1e-6 } }, {})).toEqual([])
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

it("takes the capacity's tolerance while the volume follows the seating, none for a typed one", () => {
  const seated = {
    caseVolume: 0.86e-6,
    volume: 0.55e-6,
    capacity: { fraction: 0.02, rule: 'catalogue' as const },
  }
  const run = (volume: number) =>
    runVolumeTolerance({
      volume,
      seated,
      previewed: { volume: 0.55e-6 },
      suggestion: undefined,
      followed: new Set(),
    })
  expect(run(0.55e-6).rule).toBe('catalogue')
  expect(run(0.55e-6).fraction).toBeCloseTo((0.02 * 0.86) / 0.55, 12)
  expect(run(0.6e-6)).toEqual({ fraction: undefined, rule: undefined })
})

it('reads the cavity bracket and the seated values in the fields from the snapshot a run takes (#970)', () => {
  // a hollow base of assumed cavity depth (invented demo values): the render before seated it 8 mm
  // deep, its volume in the field
  const before = {
    seated: { volume: 0.62e-6, depth: 8e-3, cavityRange: { low: 0.61e-6, high: 0.63e-6 } },
    fields: { volume: { text: '0.62', si: 0.62e-6 } },
    previewed: { volume: 0.62e-6 },
  }
  // a seating 10 mm deep arrived and was written into the field; the render has not caught up
  const arrived = {
    seated: { volume: 0.6e-6, depth: 10e-3, cavityRange: { low: 0.58e-6, high: 0.62e-6 } },
    fields: { volume: { text: '0.6', si: 0.6e-6 } },
    previewed: { volume: 0.6e-6 },
  }
  const run = runSeatingOf(arrived)
  expect(run.volumeFraction).toBeDefined()
  expect(run.volumeFraction).not.toBe(runSeatingOf(before).volumeFraction)
  expect(run.fromSeating).toEqual(['volume'])
  // the render's state mixed with the form's values now: the field no longer holds the seated
  // volume, so the bracket is dropped
  const mixed = runSeatingOf({ ...before, fields: arrived.fields })
  expect(mixed).toMatchObject({ volumeFraction: undefined, fromSeating: [] })
})
