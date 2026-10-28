/**
 * Research script: inertia of a bullet from its outline against the solid cylinder, the check of
 * the quadrature against the drawing outline polygon, the geometry-only stability factor and the
 * effect on spin drift. Run from the repository root: `node tools/research/bullet-inertia-from-outline.ts`.
 */
import {
  airDensity,
  cylinderInertia,
  gyroscopicStability,
  lbPerSqInToKgPerSqM,
  millerStability,
  type OutlineInertiaInput,
  outlineInertia,
  standardAtmosphere,
  trajectory,
} from '../../packages/core/src/index.ts'
import { bulletOutline } from '../../packages/drawing/src/bullet/outline.ts'

const grain = 0.45359237 / 7000
const air = { altitude: 0, pressure: 29.92 * 3386.389, temperature: 288.15, humidity: 0 }
const v0 = 2800 * 0.3048

const f = (x: number, n = 3) => x.toPrecision(n)
const pct = (x: number) => `${(100 * x).toFixed(1)} %`

/** Composite Simpson over the profile polygon (independent of the Gauss quadrature of core). */
function polygonMoments(points: [number, number][], mass: number) {
  const q = { v: 0, vz: 0, r4: 0 }
  const edges = points.slice(1).map((p, i) => [points[i] as [number, number], p] as const)
  const simpson = (g: (z: number) => number, a: number, b: number) => {
    const n = 4000
    const h = (b - a) / n
    let s = g(a) + g(b)
    for (let i = 1; i < n; i++) s += g(a + i * h) * (i % 2 ? 4 : 2)
    return (s * h) / 3
  }
  for (const [[r0, z0], [r1, z1]] of edges) {
    if (z1 <= z0) continue
    const r = (z: number) => r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    q.v += simpson((z) => r(z) ** 2, z0, z1)
    q.vz += simpson((z) => r(z) ** 2 * z, z0, z1)
    q.r4 += simpson((z) => r(z) ** 4, z0, z1)
  }
  const zc = q.vz / q.v
  let tr = 0
  for (const [[r0, z0], [r1, z1]] of edges) {
    if (z1 <= z0) continue
    const r = (z: number) => r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    tr += simpson((z) => r(z) ** 4 / 4 + r(z) ** 2 * (z - zc) ** 2, z0, z1)
  }
  // mm to m: lengths^5 for the moments, ^3 for the volume
  const volume = Math.PI * q.v * 1e-9
  const rho = mass / volume
  return {
    volume,
    centre: zc * 1e-3,
    axial: ((Math.PI * rho) / 2) * q.r4 * 1e-15,
    transverse: rho * Math.PI * tr * 1e-15,
  }
}

/** Demo record bullet (168 gr, 7.823 mm): the outline of the repository's demo record. */
const demo: OutlineInertiaInput = {
  mass: 0.010886,
  diameter: 0.007823,
  length: 0.0305,
  noseLength: 0.016,
  headShape: 0.55,
  boatTailLength: 0.0038,
  baseDiameter: 0.00662,
  meplatDiameter: 0.0016,
}

console.log('## Quadrature against the drawing outline polygon (demo bullet)')
const outline = bulletOutline({
  diameter: 7.823,
  length: 30.5,
  noseLength: 16,
  meplatDiameter: 1.6,
  base: { type: 'boat-tail', length: 3.8, diameter: 6.62 },
  ogive: { form: 'secant', radiusRatio: 0.55 },
})
if ('reason' in outline) throw new Error(outline.reason)
const poly = polygonMoments(outline.points, demo.mass)
const mine = outlineInertia(demo)
const cyl = cylinderInertia(demo.mass, demo.diameter, demo.length)
for (const [k, a, b] of [
  ['volume m3', mine.volume, poly.volume],
  ['centre from base m', mine.centreFromBase, poly.centre],
  ['axial kg m2', mine.axial, poly.axial],
  ['transverse kg m2', mine.transverse, poly.transverse],
] as const)
  console.log(
    `${k}: core ${f(a, 6)}, polygon ${f(b, 6)}, relative difference ${f(Math.abs(a - b) / b, 2)}`,
  )
console.log(`cylinder: axial ${f(cyl.axial)}, transverse ${f(cyl.transverse)}`)
console.log(`outline:  axial ${f(mine.axial)}, transverse ${f(mine.transverse)}`)
const ref = { axial: 7.23e-8, transverse: 5.38e-7 }
const err = (x: number, r: number) => Math.abs(x - r) / r
console.log('\n## Issue example (unverified reference 7.23e-8, 5.38e-7)')
console.log(
  `axial error: cylinder ${pct(err(cyl.axial, ref.axial))}, outline ${pct(err(mine.axial, ref.axial))}; transverse error: cylinder ${pct(err(cyl.transverse, ref.transverse))}, outline ${pct(err(mine.transverse, ref.transverse))}`,
)

/** Geometry-only stability over the Miller rule at the Miller twist of Sg 1.5 at the reference. */
function stability(b: OutlineInertiaInput) {
  const o = outlineInertia(b)
  const reference = 0.254
  const sg = millerStability({ ...b, twist: reference, velocity: v0, air })
  const twist = reference * Math.sqrt(sg / 1.5)
  const empirical = millerStability({ ...b, twist, velocity: v0, air })
  const geometric = gyroscopicStability({
    axialInertia: o.axial,
    transverseInertia: o.transverse,
    spin: (2 * Math.PI * v0) / twist,
    density: airDensity(air),
    speed: v0,
    diameter: b.diameter,
    momentSlope: o.momentSlope,
  })
  return { twist, empirical, geometric, ratio: geometric / empirical, slope: o.momentSlope }
}

/**
 * Grid of twelve rifle outlines: length ratio 3.4 to 5.4 calibers, nose 55 percent of the length,
 * Rt/R 1, 0.7 and 0.4, a boat tail of 0.3 (short bullets) or 0.5 caliber with base 0.85 caliber,
 * meplat 0.1 caliber. The mass does not enter the ratio (both factors scale with it), so one
 * density is stated. Two pistol outlines follow, outside the range of Miller's rule (l/d 3 to 6).
 */
const d = 7.82e-3
const density = 10700
const rifle = [3.4, 4.0, 4.6, 5.4].flatMap((ld) =>
  [1, 0.7, 0.4].map((q) => ({
    diameter: d,
    length: ld * d,
    noseLength: 0.55 * ld * d,
    headShape: q,
    boatTailLength: (ld < 4 ? 0.3 : 0.5) * d,
    baseDiameter: 0.85 * d,
    meplatDiameter: 0.1 * d,
    name: `l/d ${ld} Rt/R ${q}`,
  })),
)
const pistol = [1, 0.5].map((q) => ({
  diameter: 9.02e-3,
  length: 1.3 * 9.02e-3,
  noseLength: 0.6 * 9.02e-3,
  headShape: q,
  meplatDiameter: 0.3 * 9.02e-3,
  name: `pistol l/d 1.3 Rt/R ${q}`,
}))
for (const [title, shapes] of [
  ['rifle grid', rifle],
  ['pistol outlines', pistol],
] as const) {
  console.log(`\n## Moments and stability, ${title}`)
  console.log('| bullet | Ix cyl/outline | Iy cyl/outline | Sg ratio |')
  console.log('| --- | --- | --- | --- |')
  let lo = Number.POSITIVE_INFINITY
  let hi = 0
  for (const shape of shapes) {
    const mass = density * outlineInertia({ ...shape, mass: 1 }).volume
    const bullet = { ...shape, mass }
    const o = outlineInertia(bullet)
    const c = cylinderInertia(mass, bullet.diameter, bullet.length)
    const st = stability(bullet)
    lo = Math.min(lo, st.ratio)
    hi = Math.max(hi, st.ratio)
    console.log(
      `| ${shape.name} | ${f(c.axial / o.axial, 4)} | ${f(c.transverse / o.transverse, 4)} | ${f(st.ratio, 3)} |`,
    )
  }
  console.log(`ratio range ${f(lo, 3)} to ${f(hi, 3)}`)
}

console.log('\n## Spin drift, modified point mass, cylinder against outline inertia (demo bullet)')
const shot = (ix?: number, iy?: number) => ({
  projectile: {
    mass: demo.mass,
    diameter: demo.diameter,
    length: demo.length,
    drag: {
      kind: 'bc' as const,
      model: 'G7' as const,
      bands: [{ ballisticCoefficient: 0.221 * lbPerSqInToKgPerSqM, minVelocity: 0 }],
    },
    aerodynamics: { liftSlope: 2.6, axialInertia: ix, transverseInertia: iy },
  },
  muzzleVelocity: 790,
  firearm: { sightHeight: 0.05, twist: 0.254, twistHand: 'right' as const },
  air: standardAtmosphere(0),
  zero: { range: 100 },
})
const opts = { model: 'modified-point-mass' as const, coriolis: false }
const a = trajectory(shot(), [300, 600, 1000], opts)
const b = trajectory(shot(mine.axial, mine.transverse), [300, 600, 1000], opts)
a.points.forEach((p, i) => {
  const q = b.points[i]
  if (!q) return
  console.log(
    `${p.range} m: cylinder ${f(p.spinDrift * 1e3)} mm, outline ${f(q.spinDrift * 1e3)} mm, change ${pct((q.spinDrift - p.spinDrift) / p.spinDrift)}`,
  )
})
console.log(`grain ${f(demo.mass / grain)}`)
