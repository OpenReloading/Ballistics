import { interior } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import { exampleInterior } from '../src/lib/example-data.ts'
import {
  type ChartQuantity,
  type ChartX,
  chartSeries,
  chartX,
  chartY,
} from '../src/lib/interior-chart.ts'
import { interiorBody } from '../src/lib/interior-input.ts'
import {
  advance,
  curvePoint,
  type PlaybackResult,
  playbackEvents,
  sampler,
  segmentAt,
  timeScrub,
  travelScrub,
} from '../src/lib/playback.ts'
import { presetUnits } from '../src/lib/units.ts'
import { defined, missing } from './defined.ts'

const run = (
  change: Partial<Record<keyof typeof exampleInterior, number>> = {},
): PlaybackResult => {
  const result = interior(interiorBody({ ...exampleInterior, ...change }).load)
  if (!result.valid) throw new Error(`example invalid: ${result.reason}`)
  return result
}
// a faster burn than the example, as in playback.test.ts: it burns out in the barrel
const r = run({ vivacity: 1 })
const mass = interiorBody(exampleInterior).load.bullet.mass
const events = playbackEvents(r)
const stops = events.map((e) => e.time)

/** Small deterministic pseudo-random numbers in [0, 1). */
function random(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** The times a playback shows: frames of the given length range until the muzzle. */
function visit(dtMin: number, dtMax: number, seed: number) {
  const next = random(seed)
  const times = [0]
  let t = 0
  while (t < r.muzzleTime) {
    t = advance(t, dtMin + (dtMax - dtMin) * next(), r.muzzleTime, stops)
    times.push(t)
  }
  return times
}

describe('advance', () => {
  it('moves by dt and stops at the end', () => {
    expect(advance(0, 1e-6, 1, [])).toBe(1e-6)
    expect(advance(0.9, 0.5, 1, [])).toBe(1)
  })

  it('lands on an event it would pass, and goes on from it', () => {
    expect(advance(0.4, 0.3, 1, [0.5, 0.9])).toBe(0.5)
    expect(advance(0.5, 0.3, 1, [0.5, 0.9])).toBeCloseTo(0.8, 15)
    expect(advance(0.8, 0.3, 1, [0.5, 0.9])).toBe(0.9)
    // an event exactly at the end of the frame is the frame
    expect(advance(0.4, 0.1, 1, [0.5])).toBe(0.5)
  })

  // frames from 1 ms of slowed-down time (50000 times) to 100 ms (the cap) at 1000 times: the
  // simulated step is the wall time over the factor, 1.7e-8 to 1e-4 s
  for (const [name, lo, hi, seeds] of [
    ['short', 1.7e-8, 1e-7, 4],
    ['long', 1e-6, 1e-4, 200],
  ] as const)
    it(`shows every event time exactly with ${name} random frames`, () => {
      for (let seed = 1; seed <= seeds; seed++) {
        const times = visit(lo, hi, seed)
        for (const e of events) expect(times).toContain(e.time)
        // never backwards, ends at the muzzle
        for (let k = 1; k < times.length; k++)
          expect(times[k]).toBeGreaterThanOrEqual(defined(times[k - 1]))
        expect(times.at(-1)).toBe(r.muzzleTime)
      }
    })
})

describe('the dot of the playback', () => {
  const system = presetUnits('us')
  const segment = segmentAt(r.points)
  const dot = (t: number, x: ChartX, q: ChartQuantity) =>
    curvePoint(
      segment,
      t,
      (p) => chartX(p, x, system),
      (p) => chartY(p, q, mass, system),
    )

  for (const x of ['travel', 'time'] as const)
    it(`is on the drawn peak at the peak time (${x} axis)`, () => {
      const drawn = chartSeries(r.points, x, 'pressure', mass, system)
      const top = Math.max(...drawn.y)
      const vertex = drawn.y.indexOf(top)
      // the peak line of the chart is at the x of the peak time
      const lineX = chartX(defined(r.points[vertex]), x, system)
      const [px, py] = dot(r.maxPressureTime, x, 'pressure')
      expect(px).toBe(lineX)
      expect(py).toBe(top)
    })

  for (const x of ['travel', 'time'] as const)
    for (const q of ['pressure', 'velocity', 'energy'] as const)
      it(`lies on the segment the chart draws (${q} against ${x})`, () => {
        const drawn = chartSeries(r.points, x, q, mass, system)
        const next = random(7)
        for (let k = 0; k < 400; k++) {
          const t = next() * r.muzzleTime
          const [px, py] = dot(t, x, q)
          const i = Math.min(
            Math.max(
              0,
              r.points.findLastIndex((p) => p.time <= t),
            ),
            r.points.length - 2,
          )
          const [x0 = missing(), y0 = missing(), x1 = missing(), y1 = missing()] = [
            drawn.x[i],
            drawn.y[i],
            drawn.x[i + 1],
            drawn.y[i + 1],
          ]
          // between the two vertices, and on the line through them
          expect(px).toBeGreaterThanOrEqual(Math.min(x0, x1) - 1e-9)
          expect(px).toBeLessThanOrEqual(Math.max(x0, x1) + 1e-9)
          const cross = (x1 - x0) * (py - y0) - (y1 - y0) * (px - x0)
          const scale = Math.hypot(x1 - x0, y1 - y0) * Math.max(1, Math.abs(py), Math.abs(px))
          expect(Math.abs(cross)).toBeLessThanOrEqual(1e-12 * scale)
        }
      })
})

describe('the slider scales', () => {
  const system = presetUnits('us')
  const sampled = sampler(r.points)
  const xs = (x: ChartX) => r.points.map((p) => chartX(p, x, system))
  const [scaleOf, name] = [
    { travel: travelScrub(r.points), time: timeScrub(r.muzzleTime) },
    'is linear in the chart x',
  ]

  for (const x of ['travel', 'time'] as const)
    it(`${name}: the thumb is under the marker at every time and the event ticks under the event lines (${x} axis)`, () => {
      const scale = scaleOf[x]
      const [first = missing(), last] = [xs(x)[0], xs(x).at(-1) ?? 0]
      const next = random(11)
      for (let k = 0; k < 400; k++) {
        const t = next() * r.muzzleTime
        // the thumb's x is the track's start plus the position of the track's length
        const thumb = first + scale.pos(t) * (last - first)
        expect(thumb).toBeCloseTo(chartX(sampled(t), x, system), 9)
      }
      for (const e of events) {
        const line = chartX(sampled(e.time), x, system)
        expect(first + scale.pos(e.time) * (last - first)).toBeCloseTo(line, 9)
      }
    })

  it('takes a position to the time of the bullet at that travel, and back', () => {
    const travel = travelScrub(r.points)
    const first = defined(r.points[0]).time
    expect(travel.pos(first)).toBe(0)
    // the pressure rises with the bullet at rest: no travel until the shot starts
    expect(travel.pos(r.shotStartTime)).toBe(0)
    expect(travel.pos(r.muzzleTime)).toBe(1)
    // position 0 is ignition, 1 the muzzle
    expect(travel.time(0)).toBe(first)
    expect(travel.time(1)).toBe(r.muzzleTime)
    let before = 0
    for (let k = 1; k <= 100; k++) {
      const t = r.shotStartTime + ((r.muzzleTime - r.shotStartTime) * k) / 100
      const p = travel.pos(t)
      expect(p).toBeGreaterThanOrEqual(before)
      before = p
      expect(travel.time(p)).toBeCloseTo(t, 12)
    }
    const time = timeScrub(r.muzzleTime)
    expect(time.pos(0.25 * r.muzzleTime)).toBeCloseTo(0.25, 15)
    expect(time.time(0.25)).toBeCloseTo(0.25 * r.muzzleTime, 18)
  })
})
