import { interior } from '@open-reloading/core'
import { expect, it } from 'vitest'
import { baseAt, flightAt, flightTime, type StripModel } from '../src/lib/barrel-strip.ts'
import { exampleInterior } from '../src/lib/example-data.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import {
  defaultFactor,
  energySplit,
  eventStep,
  type PlaybackResult,
  playbackEvents,
  powderSplit,
  sampler,
  timeIndex,
} from '../src/lib/playback.ts'

/** Made-up uneven times with repeats, as event points add them. */
const times = [0, 1, 2, 2, 2.5, 4, 4, 4, 10, 10.1, 12]

/** Last interval start at or before t, 0 to n - 2. */
function scan(t: number) {
  let i = 0
  for (let k = 0; k < times.length - 1; k++) if (times[k] <= t) i = k
  return i
}

const { load } = interiorBody(exampleInterior)

/** The interior example through core, with changed form values (SI). */
function run(change: Partial<Record<keyof typeof exampleInterior, number>> = {}): PlaybackResult {
  const r = interior(interiorBody({ ...exampleInterior, ...change }).load)
  if (!r.valid) throw new Error(`example invalid: ${r.reason}`)
  return r
}

// a faster burn than the example's RS50 start load, so the powder burns out in the barrel
const r = run({ vivacity: 1 })

it('finds the interval of a time like a linear scan, the last of equal times', () => {
  const index = timeIndex(times)
  for (let k = -20; k <= 260; k++) expect(index(k / 20)).toBe(scan(k / 20))
  for (const t of times) expect(index(t)).toBe(scan(t))
  expect(index(4)).toBe(7)
})

it('clamps before the first and after the last time', () => {
  const index = timeIndex(times)
  expect(index(-5)).toBe(0)
  expect(index(Number.NaN)).toBe(0)
  expect(index(12)).toBe(times.length - 2)
  expect(index(99)).toBe(times.length - 2)

  const at = sampler(r.points)
  const first = r.points[0]
  expect(at(-1)).toEqual({
    time: first.time,
    travel: first.travel,
    velocity: first.velocity,
    burntFraction: first.burntFraction,
    meanPressure: first.meanPressure,
    breechPressure: first.breechPressure,
  })
  expect(at(r.muzzleTime)).toBe(r.points.at(-1))
  expect(at(1)).toBe(r.points.at(-1))
})

it('interpolates linearly in time between neighbouring points', () => {
  const at = sampler(r.points)
  const i = 100
  const [a, b] = [r.points[i], r.points[i + 1]]
  const s = at(a.time + 0.25 * (b.time - a.time))
  expect(s.travel).toBeCloseTo(a.travel + 0.25 * (b.travel - a.travel), 15)
  expect(s.velocity).toBeCloseTo(a.velocity + 0.25 * (b.velocity - a.velocity), 10)
  expect(
    s.breechPressure / (a.breechPressure + 0.25 * (b.breechPressure - a.breechPressure)),
  ).toBeCloseTo(1, 12)
  expect(at(a.time).velocity).toBe(a.velocity)
})

it('lists shot start, peak, burnout and muzzle by time, each at its event point', () => {
  const events = playbackEvents(r)
  expect(events.map((e) => e.key)).toEqual(['start', 'peak', 'burnout', 'muzzle'])
  const at = sampler(r.points)
  expect(at(r.maxPressureTime).breechPressure).toBe(r.peakBreechPressure)
  expect(r.burnout && at(r.burnout.time).burntFraction).toBe(1)
  expect(at(r.muzzleTime).velocity).toBe(r.muzzleVelocity)
})

it('leaves out burnout when the powder burns past the muzzle and keeps tied events in order', () => {
  expect(playbackEvents({ ...r, burnout: null }).map((e) => e.key)).toEqual([
    'start',
    'peak',
    'muzzle',
  ])
  const tied = { ...r, burnout: { time: r.maxPressureTime, travel: r.maxPressureTravel } }
  expect(playbackEvents(tied).map((e) => e.key)).toEqual(['start', 'peak', 'burnout', 'muzzle'])
  // the peak before shot start, both before burnout
  const b = r.burnout?.time as number
  const early = { ...r, shotStartTime: 0.9 * b, maxPressureTime: 0.5 * b }
  expect(playbackEvents(early).map((e) => e.key)).toEqual(['peak', 'start', 'burnout', 'muzzle'])
})

it('splits the charge at shot start and at the muzzle', () => {
  // start pressure 0: the bullet moves from the first point
  const free = run({ startPressure: 0 })
  const split = powderSplit(free, sampler(free.points))
  expect(split.before).toBe(free.points[0].burntFraction)
  expect(split.travel).toBe(free.muzzleBurntFraction - split.before)
  // the example's demo powder leaves a little powder unburnt at the muzzle
  expect(split.unburnt).toBeCloseTo(1 - free.muzzleBurntFraction, 15)

  const late = run({ startPressure: 3e7 })
  expect(late.shotStartTime).toBeGreaterThan(0)
  const start = late.points.findLast((p) => p.time === late.shotStartTime)
  expect(powderSplit(late, sampler(late.points)).before).toBe(start?.burntFraction)

  const slow = run({ vivacity: 0.2 })
  expect(slow.burnout).toBeNull()
  const s = powderSplit(slow, sampler(slow.points))
  expect(s.unburnt).toBeGreaterThan(0.001)
  expect(s.before + s.travel + s.unburnt).toBeCloseTo(1, 15)
})

it('gives the muzzle energy terms as shares of the released energy, unsent terms of 0 apart', () => {
  const e = energySplit(r.energy)
  expect(
    e.total / (load.charge * load.propellant.specificEnergy * r.muzzleBurntFraction),
  ).toBeCloseTo(1, 12)
  expect(e.shown.map((t) => t.key)).toEqual(['translation', 'rotation', 'gasKinetic', 'gas'])
  expect(e.zero.map((t) => t.key)).toEqual(['resistance', 'heat', 'leakage'])
  expect(e.shown.reduce((sum, t) => sum + t.share, 0)).toBeCloseTo(1, 12)
  expect(e.shown[0].value / r.muzzleEnergy).toBeCloseTo(1, 12)

  // without rifling the spin term is 0 but modelled, so it stays listed
  const smooth = energySplit(run({ twist: 0 }).energy)
  expect(smooth.shown.map((t) => [t.key, t.value === 0])).toEqual([
    ['translation', false],
    ['rotation', true],
    ['gasKinetic', false],
    ['gas', false],
  ])
  expect(smooth.zero.map((t) => t.key)).toEqual(['resistance', 'heat', 'leakage'])
})

it('slows playback by the smallest factor that makes it last at least 3 s', () => {
  expect(r.muzzleTime).toBeCloseTo(1.1783e-3, 5)
  expect(defaultFactor(r.muzzleTime)).toBe(5000)
  expect(defaultFactor(1.687e-3)).toBe(2000)
  expect(defaultFactor(0.4e-3)).toBe(10000)
  expect(defaultFactor(5e-3)).toBe(1000)
  expect(defaultFactor(1e-5)).toBe(50000)
})

it('steps from a time to the next or the previous event, past an event at that time', () => {
  const events = playbackEvents(r)
  const [start, peak] = events
  expect(eventStep(events, 0, 1)).toBe(start)
  expect(eventStep(events, start.time, 1)).toBe(peak)
  expect(eventStep(events, peak.time, -1)).toBe(start)
  expect(eventStep(events, start.time, -1)).toBeUndefined()
  expect(eventStep(events, r.muzzleTime, 1)).toBeUndefined()
})

it('moves the bullet on past the muzzle at the muzzle velocity, from where the travel left it', () => {
  // only the base's z is read
  const m = { base: 40 } as StripModel
  const muzzle = { travel: 0.6, velocity: 800 }
  expect(flightAt(m, muzzle, 0)).toBe(baseAt(m, muzzle.travel))
  expect(flightAt(m, muzzle, 1e-4) - flightAt(m, muzzle, 0)).toBeCloseTo(80, 12)
  expect(flightTime(m, muzzle, flightAt(m, muzzle, 2.5e-4))).toBeCloseTo(2.5e-4, 15)
  expect(flightTime(m, muzzle, 600)).toBe(0)
  expect(flightTime(m, { ...muzzle, velocity: 0 }, 700)).toBe(0)
})
