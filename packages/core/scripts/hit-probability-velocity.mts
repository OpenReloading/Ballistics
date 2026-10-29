// Velocity-spread term of the hit probability against a seeded simulation of impact heights
// (apps/docs/docs/research/hit-probability-velocity-term.md). Run: node packages/core/scripts/hit-probability-velocity.mts
// Synthetic loads only; every number is a simulation, not load data.
import {
  lbPerSqInToKgPerSqM,
  standardAtmosphere,
  type TrajectoryInput,
  trajectory,
  zeroAngles,
} from '../src/index.ts'
import { normals } from './rng.mts'

/** The five synthetic loads: muzzle velocity m/s, G7 ballistic coefficient lb/in^2, velocity SD m/s. */
const loads = [
  { v0: 900, bc: 0.27, sd: 3 },
  { v0: 800, bc: 0.22, sd: 5 },
  { v0: 850, bc: 0.3, sd: 8 },
  { v0: 700, bc: 0.2, sd: 10 },
  { v0: 950, bc: 0.35, sd: 12 },
]
const distances = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
const referenceDistance = 100
/** Vertical SD of the velocity-independent dispersion at the reference distance, m: 0.06 and 0.2 mrad. */
const intrinsicSds = [0.006, 0.02]
const samples = 5000
const step = 1 // muzzle speed perturbation, m/s

const air = standardAtmosphere(0)
const shot = (v0: number, bc: number, zero: TrajectoryInput['zero']): TrajectoryInput => ({
  projectile: {
    mass: 0.0113,
    diameter: 0.00782,
    length: 0.0315,
    drag: {
      kind: 'bc',
      model: 'G7',
      bands: [{ ballisticCoefficient: bc * lbPerSqInToKgPerSqM, minVelocity: 0 }],
    },
  },
  muzzleVelocity: v0,
  firearm: { sightHeight: 0.05 },
  air,
  zero,
})
const heights = (input: TrajectoryInput) =>
  trajectory(input, distances, { coriolis: false }).points.map((p) => p.height)

const sd = (xs: number[]) => {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1))
}

for (const intrinsicSd of intrinsicSds) {
  const out: string[] = [
    'load,distance_m,velocity_part_mm,share,sim_mm,model_mm,model_err,linear_mm,linear_err',
  ]
  let worstModel = 0
  let maxShare = 0
  let minShare = 1
  let worstLinear = 0
  loads.forEach((l, li) => {
    const bore = zeroAngles(shot(l.v0, l.bc, { range: referenceDistance }), { coriolis: false })
    const nominal = heights(shot(l.v0, l.bc, bore))
    const perturbed = heights(shot(l.v0 + step, l.bc, bore))
    const slope = perturbed.map((h, i) => (h - (nominal[i] ?? 0)) / step)
    const draw = normals(1000 + li)
    const byDistance = distances.map(() => [] as number[])
    for (let n = 0; n < samples; n++) {
      const hs = heights(shot(l.v0 + l.sd * draw(), l.bc, bore))
      // the velocity-independent part is drawn once per shot and scales with the distance
      const a = draw() * intrinsicSd
      hs.forEach((h, i) => {
        byDistance[i]?.push(h + (a * (distances[i] ?? 1)) / referenceDistance)
      })
    }
    const velocityAt = (i: number) => Math.abs(slope[i] ?? 0) * l.sd
    // the group a shooter measures at the reference distance is the simulated one, velocity part included
    const observedReference = sd(byDistance[0] ?? [])
    const intrinsicEstimate = Math.sqrt(observedReference ** 2 - velocityAt(0) ** 2)
    distances.forEach((d, i) => {
      const k = d / referenceDistance
      const sim = sd(byDistance[i] ?? [])
      const model = Math.hypot(intrinsicEstimate * k, velocityAt(i))
      const linear = observedReference * k
      const share = velocityAt(i) / model
      maxShare = Math.max(maxShare, share)
      minShare = Math.min(minShare, share)
      worstLinear = Math.max(worstLinear, Math.abs(linear / sim - 1))
      worstModel = Math.max(worstModel, Math.abs(model / sim - 1))
      out.push(
        [
          li + 1,
          d,
          (1000 * velocityAt(i)).toFixed(2),
          share.toFixed(3),
          (1000 * sim).toFixed(2),
          (1000 * model).toFixed(2),
          (model / sim - 1).toFixed(4),
          (1000 * linear).toFixed(2),
          (linear / sim - 1).toFixed(4),
        ].join(','),
      )
    })
  })
  console.log(`intrinsic vertical SD at ${referenceDistance} m: ${1000 * intrinsicSd} mm`)
  console.log(out.join('\n'))
  console.log(
    `worst model error ${worstModel.toFixed(4)}, worst linear error ${worstLinear.toFixed(4)}, velocity share ${minShare.toFixed(3)} to ${maxShare.toFixed(3)}`,
  )
}
