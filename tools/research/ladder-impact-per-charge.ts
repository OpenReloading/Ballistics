/**
 * Research script: can the vertical centre of ladder groups, corrected for the drop caused by the
 * velocity, show an oscillation with the charge at realistic shot counts? Seeded ladders; the
 * rules are fixed in the entry before the run. Run from the repository root:
 * `node tools/research/ladder-impact-per-charge.ts`.
 *
 * Assumptions (all stated in the entry): 9 charges over 4 grains in half-grain steps; 25 ft/s per
 * grain; velocity SD of a shot 8 ft/s; vertical SD of a shot 0.06 in; the drop slope 0.04 in per
 * 30 ft/s; the injected oscillation 0.1 in amplitude, one cycle over the charge range, uniformly
 * random phase. Groups of 5 shots, 3 or 4 groups per charge.
 */
import { ladderFlatSpots, ladderImpactResiduals } from '../../packages/core/src/index.ts'
import { normals, uniforms } from '../../packages/core/test/random.ts'

const IN = 0.0254
const FPS = 0.3048
const STEPS = 9
const RANGE = 4
const FPS_PER_GRAIN = 25
const VELOCITY_SD = 8 * FPS
const HEIGHT_SD = 0.06 * IN
const SLOPE = (0.04 * IN) / (30 * FPS)
const AMPLITUDE = 0.1 * IN
const LADDERS = 20_000

/** Wrapped difference of two angles, in (-pi, pi]. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

/** Least squares of z = c + a cos(2 pi u) + b sin(2 pi u) at the nine charges; the phase of b + i a. */
function fittedPhase(z: number[]): number {
  const u = z.map((_, i) => i / (STEPS - 1))
  const basis = u.map((x) => [1, Math.cos(2 * Math.PI * x), Math.sin(2 * Math.PI * x)])
  const g = [0, 1, 2].map((i) =>
    [0, 1, 2].map((j) => basis.reduce((s, row) => s + (row[i] as number) * (row[j] as number), 0)),
  )
  const rhs = [0, 1, 2].map((i) =>
    basis.reduce((s, row, k) => s + (row[i] as number) * (z[k] as number), 0),
  )
  // Cramer's rule for the 3 x 3 normal equations
  const det = (m: number[][]) => {
    const r = (i: number) => m[i] as number[]
    return (
      (r(0)[0] as number) *
        ((r(1)[1] as number) * (r(2)[2] as number) - (r(1)[2] as number) * (r(2)[1] as number)) -
      (r(0)[1] as number) *
        ((r(1)[0] as number) * (r(2)[2] as number) - (r(1)[2] as number) * (r(2)[0] as number)) +
      (r(0)[2] as number) *
        ((r(1)[0] as number) * (r(2)[1] as number) - (r(1)[1] as number) * (r(2)[0] as number))
    )
  }
  const d = det(g)
  const solve = (col: number) =>
    det(g.map((row, i) => row.map((v, j) => (j === col ? (rhs[i] as number) : v)))) / d
  return Math.atan2(solve(1), solve(2))
}

interface Outcome {
  flagged: number
  recovered: number
  recoveredWhenFlagged: number
  flaggedCount: number
  nonFlatSegment: number
  flatRunAtExtremum: number
}

function run(groups: number, amplitude: number, slopeError: number, seed: number): Outcome {
  const normal = normals(seed)
  const uniform = uniforms(seed + 1)
  const out: Outcome = {
    flagged: 0,
    recovered: 0,
    recoveredWhenFlagged: 0,
    flaggedCount: 0,
    nonFlatSegment: 0,
    flatRunAtExtremum: 0,
  }
  const shots = 5 * groups
  for (let l = 0; l < LADDERS; l++) {
    const phase = 2 * Math.PI * uniform()
    const charges = Array.from({ length: STEPS }, (_, i) => {
      const grains = (i * RANGE) / (STEPS - 1)
      const oscillation = amplitude * Math.sin(2 * Math.PI * (i / (STEPS - 1)) + phase)
      const velocities = Array.from(
        { length: shots },
        () => (grains * FPS_PER_GRAIN + 2800) * FPS + VELOCITY_SD * normal(),
      )
      const heights = velocities.map(
        (v) => SLOPE * (v - 2850 * FPS) + oscillation + HEIGHT_SD * normal(),
      )
      return { charge: 0.002 + i * 0.0001, heights, velocities }
    })
    const r = ladderImpactResiduals(charges, SLOPE * (1 + slopeError))
    const flagged = r.varies
    const err = Math.abs(wrap(fittedPhase(r.steps.map((s) => s.mean)) - phase))
    if (flagged) out.flagged++
    if (err < Math.PI / 4) {
      out.recovered++
      if (flagged) out.recoveredWhenFlagged++
    }
    if (flagged) out.flaggedCount++
    const flat = ladderFlatSpots(r.steps)
    if (flat.segments.some((s) => !s.flat)) out.nonFlatSegment++
    // a flat run containing the step nearest the true trough or crest
    const extrema = [0.25, 0.75].map((q) => {
      const u = (((q - phase / (2 * Math.PI)) % 1) + 1) % 1
      return Math.round(u * (STEPS - 1))
    })
    if (
      extrema.some((i) =>
        flat.flatSpots.some(
          (f) => f.from <= 0.002 + i * 0.0001 + 1e-9 && f.to >= 0.002 + i * 0.0001 - 1e-9,
        ),
      )
    )
      out.flatRunAtExtremum++
  }
  return out
}

const pct = (x: number) => `${((100 * x) / LADDERS).toFixed(1)} %`
console.log(`${LADDERS} seeded ladders per row; ${STEPS} charges over ${RANGE} grains\n`)
console.log(
  '| groups per charge | oscillation | slope error | note shown (1 % test) | phase within 45 deg, all ladders | phase within 45 deg, flagged | any non-flat segment (95 % bands) | flat run holds a true extremum |',
)
console.log('| --- | --- | --- | --- | --- | --- | --- | --- |')
const cases: [number, number, number][] = [
  [3, AMPLITUDE, 0],
  [4, AMPLITUDE, 0],
  [3, AMPLITUDE, 0.2],
  [3, AMPLITUDE / 2, 0],
  [3, 0, 0],
  [4, 0, 0],
  [3, 0, 0.2],
]
const results = cases.map(([g, a, e], i) => ({ g, a, e, o: run(g, a, e, 370_500 + 10 * i) }))
for (const { g, a, e, o } of results)
  console.log(
    `| ${g} | ${a === 0 ? 'none' : `${(a / IN).toFixed(2)} in`} | ${100 * e} % | ${pct(o.flagged)} | ${pct(o.recovered)} | ${o.flagged ? ((100 * o.recoveredWhenFlagged) / o.flagged).toFixed(1) : '-'} % | ${pct(o.nonFlatSegment)} | ${pct(o.flatRunAtExtremum)} |`,
  )

const main = results[0]?.o as Outcome
const none = results[4]?.o as Outcome
const recovered = main.recovered / LADDERS
const falseFlags = none.flagged / LADDERS
console.log(
  `\nRule: phase recovered in more than 70 % of ladders at 3 groups per charge: ${recovered > 0.7}`,
)
console.log(`Rule: false flags (note shown with no oscillation) under 5 %: ${falseFlags < 0.05}`)
console.log(`build: ${recovered > 0.7 && falseFlags < 0.05 ? 'yes' : 'no'}`)
