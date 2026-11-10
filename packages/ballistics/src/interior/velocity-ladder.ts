/** Charge ranges where the mean velocity changes least with charge, from the mean, spread and shot count of each string (`apps/docs/docs/models/interior-velocity-ladder.md`); SI throughout: charge kg, velocity m/s. */

import { nth, studentTwoSidedQuantile } from '@open-reloading/statistics'
import { need } from '../issue.ts'

/** One string of a ladder: the charge, the mean and sample standard deviation of its velocities, and its shot count. */
export interface LadderStep {
  charge: number
  mean: number
  standardDeviation: number
  count: number
}

/** The slope of mean velocity against charge between two neighboring steps. */
export interface LadderSegment {
  /** Charges of the two steps, kg. */
  from: number
  to: number
  /** Change of mean velocity per charge, m/s per kg. */
  slope: number
  /** Half width of the confidence band of the slope, m/s per kg. */
  halfWidth: number
  /** The band includes zero. */
  flat: boolean
  /** Shots of the two strings. */
  counts: [number, number]
}

/** A run of neighboring flat segments. */
export interface FlatSpot {
  /** Lowest and highest charge of the run, kg. */
  from: number
  to: number
  /** Shots of each string in the run, by ascending charge. */
  counts: number[]
}

/** Result of {@link ladderFlatSpots}. */
export interface LadderFlatSpots {
  /** Confidence level of the bands. */
  level: number
  segments: LadderSegment[]
  flatSpots: FlatSpot[]
}

/** Checks one string of a ladder: a positive charge, a finite mean, a spread of at least 0 and two shots or more. */
function checkLadderStep(s: LadderStep): void {
  need(Number.isFinite(s.charge) && s.charge > 0, { code: 'chargeNotPositive', params: {} })
  need(Number.isFinite(s.mean), { code: 'meanNotFinite', params: {} })
  need(Number.isFinite(s.standardDeviation) && s.standardDeviation >= 0, {
    code: 'standardDeviationNegative',
    params: {},
  })
  need(Number.isInteger(s.count) && s.count >= 2, { code: 'stringTooFewShots', params: {} })
}

/** The segment from string a to the next charge b: the slope of the mean velocity and its band at `level`. */
function ladderSegment(a: LadderStep, b: LadderStep, level: number): LadderSegment {
  need(b.charge > a.charge, { code: 'chargesEqual', params: {} })
  const va = a.standardDeviation ** 2 / a.count
  const vb = b.standardDeviation ** 2 / b.count
  const df =
    va + vb === 0
      ? a.count + b.count - 2
      : Math.max(
          1,
          Math.floor((va + vb) ** 2 / (va ** 2 / (a.count - 1) + vb ** 2 / (b.count - 1))),
        )
  const dc = b.charge - a.charge
  const slope = (b.mean - a.mean) / dc
  const halfWidth = (studentTwoSidedQuantile(level, df) * Math.sqrt(va + vb)) / dc
  return {
    from: a.charge,
    to: b.charge,
    slope,
    halfWidth,
    flat: Math.abs(slope) <= halfWidth,
    counts: [a.count, b.count],
  }
}

/** Each segment's slope of the mean velocity with a two-sided band from Welch's standard error and t quantile (whole degrees of freedom, rounded down), and the runs of segments whose band includes zero; steps ascending in charge, each with at least two shots. */
export function ladderFlatSpots(steps: readonly LadderStep[], level = 0.95): LadderFlatSpots {
  need(steps.length >= 2, { code: 'ladderTooFewStrings', params: {} })
  const sorted = steps.toSorted((a, b) => a.charge - b.charge)
  for (const s of sorted) checkLadderStep(s)
  const segments = sorted.slice(1).map((b, i) => ladderSegment(nth(sorted, i), b, level))
  const flatSpots: FlatSpot[] = []
  let run: LadderSegment[] = []
  const close = () => {
    if (run.length > 0)
      flatSpots.push({
        from: nth(run, 0).from,
        to: nth(run, run.length - 1).to,
        counts: [nth(run, 0).counts[0], ...run.map((s) => s.counts[1])],
      })
    run = []
  }
  for (const s of segments) {
    if (s.flat) run.push(s)
    else close()
  }
  close()
  return { level, segments, flatSpots }
}
