import type { InteriorResponse } from './api-types.ts'

/** The M3 result of `POST /interior` as the chart's playback reads it. */
export type PlaybackResult = InteriorResponse['result']
type Point = PlaybackResult['points'][number]

/** Point fields the playback shows, linear in time between points. */
export type PlaybackSample = Pick<
  Point,
  'time' | 'travel' | 'velocity' | 'burntFraction' | 'meanPressure' | 'breechPressure'
>

/** Playback slow-down factors: the shot is shown this many times slower than simulated. */
export const slowFactors = [1000, 2000, 5000, 10000, 20000, 50000] as const

/** The smallest factor that makes playback of `duration` s last at least 3 s, else the largest. */
export function defaultFactor(duration: number): number {
  return slowFactors.find((f) => duration * f >= 3) ?? slowFactors[slowFactors.length - 1]
}

/** Positions of the time slider: k from 0 to `scrubSteps` is k / `scrubSteps` of the muzzle time. */
export const scrubSteps = 1000

/**
 * Index i of the interval with times[i] <= t < times[i + 1], from 0 to n - 2; equal times give the
 * last of them. Before the first time (and NaN) 0, at or after the last n - 2. One table cell per
 * point holds the index at the cell start, so a lookup walks only the few points of its cell.
 */
export function timeIndex(times: readonly number[]): (t: number) => number {
  const n = times.length
  const t0 = times[0]
  const width = (times[n - 1] - t0) / n
  const start = new Int32Array(n + 1)
  for (let c = 0, i = 0; c <= n; c++) {
    while (i < n - 2 && times[i + 1] <= t0 + c * width) i++
    start[c] = i
  }
  return (t) => {
    if (!(t >= t0)) return 0
    let i = start[Math.min(n, Math.floor((t - t0) / width))]
    while (i < n - 2 && times[i + 1] <= t) i++
    return i
  }
}

/**
 * The interval of time t and the fraction of it already passed: points i and i + 1 and f from 0 to
 * 1, so every value of the playback is a mix of the same two points. From the last point on both
 * are the last point and f is 0; before the first, the first.
 */
export function segmentAt(points: readonly Point[]) {
  const index = timeIndex(points.map((p) => p.time))
  const last = points[points.length - 1]
  return (t: number): { a: Point; b: Point; f: number } => {
    if (t >= last.time) return { a: last, b: last, f: 0 }
    const i = index(t)
    const [a, b] = [points[i], points[i + 1]]
    return { a, b, f: t > a.time ? (t - a.time) / (b.time - a.time) : 0 }
  }
}

/** Values at time t, linear between the neighbouring points; before the first and from the last point the end values. */
export function sampler(points: readonly Point[]): (t: number) => PlaybackSample {
  const segment = segmentAt(points)
  const last = points[points.length - 1]
  return (t) => {
    if (t >= last.time) return last
    const { a, b, f } = segment(t)
    // a (1 - f) + b f is a itself at f = 0
    const mix = (k: keyof PlaybackSample) => a[k] * (1 - f) + b[k] * f
    return {
      time: mix('time'),
      travel: mix('travel'),
      velocity: mix('velocity'),
      burntFraction: mix('burntFraction'),
      meanPressure: mix('meanPressure'),
      breechPressure: mix('breechPressure'),
    }
  }
}

/**
 * The point of the drawn curve at time t: `x` and `y` of the two neighbouring points of `segment`
 * mixed by the same fraction, so it lies on the segment the chart draws between them, also for a
 * `y` that is not linear in the sampled values (the energy, 0.5 m v^2). At a point's own time it
 * is that point's `[x, y]`.
 */
export function curvePoint(
  segment: ReturnType<typeof segmentAt>,
  t: number,
  x: (p: Point) => number,
  y: (p: Point) => number,
): [number, number] {
  const { a, b, f } = segment(t)
  return [x(a) * (1 - f) + x(b) * f, y(a) * (1 - f) + y(b) * f]
}

/** The slider's scale: `pos` is the position from 0 to 1 of a time, `time` the time of a position. */
type Scrub = { pos: (t: number) => number; time: (p: number) => number }

/** Linear in time, from ignition to `end`: the slider's value k is k / `scrubSteps` of `end`. */
export const timeScrub = (end: number): Scrub => ({ pos: (t) => t / end, time: (p) => p * end })

/**
 * Linear in the bullet's travel, so the thumb is where the bullet is on a travel axis. Position 0
 * is ignition: the time before the shot starts has no travel, so the thumb stays at 0 from
 * ignition to the shot start and every position above 0 is a time of the bullet's motion. Position
 * 1 is the muzzle.
 */
export function travelScrub(points: readonly Point[]): Scrub {
  const segment = segmentAt(points)
  const start = points[0].travel
  const span = points[points.length - 1].travel - start
  return {
    pos: (t) => {
      const { a, b, f } = segment(t)
      return span > 0 ? (a.travel * (1 - f) + b.travel * f - start) / span : 0
    },
    time: (p) => {
      if (!(p > 0) || !(span > 0)) return points[0].time
      const target = start + Math.min(p, 1) * span
      // the first point beyond the travel; travel does not decrease
      let [lo, hi] = [0, points.length]
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (points[mid].travel > target) hi = mid
        else lo = mid + 1
      }
      if (lo === points.length) return points[lo - 1].time
      const [a, b] = [points[lo - 1], points[lo]]
      return a.time + ((target - a.travel) / (b.travel - a.travel)) * (b.time - a.time)
    },
  }
}

/**
 * The time a playback frame shows: `t + dt`, at most `end`, but never past the next of the
 * `stops` (event times, ascending) after `t`: a frame lands on it, so the marker is on the event
 * line, and the playback goes on from it. A stop at `t` itself is passed.
 */
export function advance(t: number, dt: number, end: number, stops: readonly number[]): number {
  const next = Math.min(end, t + dt)
  const stop = stops.find((s) => s > t + 1e-12)
  return stop !== undefined && stop < next ? stop : next
}

export type PlaybackEvent = {
  key: 'start' | 'peak' | 'burnout' | 'muzzle'
  label: string
  time: number
}

/** Shot start, peak breech pressure, burnout when it is in the barrel, and muzzle exit, by time. */
export function playbackEvents(r: PlaybackResult): PlaybackEvent[] {
  const events: PlaybackEvent[] = [
    { key: 'start', label: 'Shot start', time: r.shotStartTime },
    { key: 'peak', label: 'Peak breech pressure', time: r.maxPressureTime },
  ]
  if (r.burnout) events.push({ key: 'burnout', label: 'Burnout', time: r.burnout.time })
  events.push({ key: 'muzzle', label: 'Muzzle exit', time: r.muzzleTime })
  return events.sort((x, y) => x.time - y.time)
}

/** Fractions of the charge burnt before the bullet moves, burnt while it travels, and unburnt at the muzzle. */
export function powderSplit(r: PlaybackResult, at: (t: number) => PlaybackSample) {
  const before = at(r.shotStartTime).burntFraction
  return { before, travel: r.muzzleBurntFraction - before, unburnt: 1 - r.muzzleBurntFraction }
}

const energyLabels = {
  translation: 'Bullet motion',
  rotation: 'Bullet spin',
  gasKinetic: 'Gas motion',
  gas: 'Left in the gas',
  resistance: 'Bore friction and engraving',
  heat: 'Heat to the bore',
  leakage: 'Gas leaking past the bullet',
} as const

/** Terms whose inputs the web form does not send, so 0 means not modelled. */
const unsent: ReadonlySet<string> = new Set(['resistance', 'heat', 'leakage'])

/**
 * Muzzle energy terms (J) with their share of the released energy, and their sum. Resistance, heat
 * and leakage of 0 are apart; spin is listed even at 0 (a bore without rifling).
 */
export function energySplit(energy: PlaybackResult['energy']) {
  const keys = Object.keys(energyLabels) as (keyof typeof energyLabels)[]
  const total = keys.reduce((sum, k) => sum + energy[k], 0)
  const terms = keys.map((key) => ({
    key,
    label: energyLabels[key],
    value: energy[key],
    share: energy[key] / total,
  }))
  const notModelled = (t: (typeof terms)[number]) => t.value === 0 && unsent.has(t.key)
  return {
    total,
    shown: terms.filter((t) => !notModelled(t)),
    zero: terms.filter(notModelled),
  }
}

/**
 * The first event after time t (direction 1) or the last before it (-1); a tolerance of 1e-12 s
 * keeps an event at t itself from being chosen again. Undefined past the last or before the first.
 */
export function eventStep(events: readonly PlaybackEvent[], t: number, direction: 1 | -1) {
  return direction > 0
    ? events.find((e) => e.time > t + 1e-12)
    : events.findLast((e) => e.time < t - 1e-12)
}
