/**
 * Derivation of the default hot burn-rate sensitivity of extruded and flake powders
 * (`apps/docs/docs/research/powder-temperature-default.md`). Stand-in loads only: simulations, not
 * load data. Run from the repository root, after `npm ci`:
 *
 *   node packages/core/scripts/powder-temperature-default.mts
 *
 * Input: the velocities at 70 and 125 °F of the 17 powders outside the Extreme line in Hodgdon
 * Powder Co., "Extreme Rifle Powders, test results for temperature sensitivity", 13 July 2012
 * (bibliography: hodgdon-2012), maker data, shots and lots not stated. The grain form of each
 * powder is the maker's line: Win 748, AA 2520 and AA 2460 are ball powders, the others extruded.
 *
 * Method: three stand-in rifle loads of a seven-perforated grain behind 10.9 g (charges 2.4, 2.8
 * and 3.2 g), each with the burn coefficient set so it peaks at 380 MPa at 294.15 K. For each powder
 * the sensitivity sigma (same on both sides) is found by bisection so that the load at +30.56 K
 * (55 °F) changes its muzzle velocity as the powder did. Printed: mean and sample standard
 * deviation of sigma over the 14 extruded powders and over all 17, per load.
 */
import { type InteriorLoad, interior } from '../src/index.ts'

const rows: readonly [string, 'ball' | 'extruded', number, number][] = [
  ['Reloder 19', 'extruded', 2820, 2902],
  ['IMR 4350', 'extruded', 2908, 2941],
  ['VIT N550', 'extruded', 2883, 2927],
  ['AA 4350', 'extruded', 2786, 2772],
  ['AA 3100', 'extruded', 3050, 3113],
  ['IMR 4831', 'extruded', 3012, 3080],
  ['VIT N560', 'extruded', 3009, 3101],
  ['Reloder 22', 'extruded', 3087, 3142],
  ['Win 748', 'ball', 2724, 2769],
  ['Reloder 15', 'extruded', 2715, 2705],
  ['VIT N140, 308 Win.', 'extruded', 2665, 2679],
  ['IMR 4064', 'extruded', 2686, 2697],
  ['AA 2520', 'ball', 2805, 2844],
  ['VIT N140, 22-250 Rem.', 'extruded', 3662, 3692],
  ['Reloder 12', 'extruded', 3607, 3609],
  ['AA 2460', 'ball', 3671, 3707],
  ['IMR 4895', 'extruded', 3699, 3791],
]
const reference = 294.15
const step = ((125 - 70) * 5) / 9

const standIn = (charge: number, coefficient: number): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 7e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0109 },
  charge,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'geometric',
      coefficient,
      exponent: 0.9,
      grain: { shape: 'sevenPerf', diameter: 1.25e-3, perforationDiameter: 1.5e-4, length: 2e-3 },
    },
  },
  propellantTemperature: reference,
  ignitionPressure: 5e6,
  startPressure: 25e6,
})

const valid = (load: InteriorLoad) => {
  const r = interior(load)
  if (!r.valid) throw new Error(r.reason)
  return r
}

/** The load of `charge` whose burn coefficient gives a 380 MPa peak at the reference. */
function calibrated(charge: number) {
  let [lo, hi] = [1e-10, 1e-7]
  for (let i = 0; i < 80; i++) {
    const mid = Math.sqrt(lo * hi)
    const r = interior(standIn(charge, mid))
    if (r.valid && r.peakBreechPressure > 380e6) hi = mid
    else lo = mid
  }
  return standIn(charge, lo)
}

const hot = (load: InteriorLoad, sigma: number) =>
  valid({
    ...load,
    propellantTemperature: reference + step,
    propellant: {
      ...load.propellant,
      temperatureSensitivity: { reference, cold: sigma, hot: sigma },
    },
  })

const stats = (xs: number[]) => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1))
  return { mean, sd }
}

console.log('| Load | Velocity | sigma 0.0025: dv | Extruded (14) mean, SD | All 17 mean, SD |')
console.log('|---|---|---|---|---|')
for (const charge of [0.0024, 0.0028, 0.0032]) {
  const load = calibrated(charge)
  const v0 = valid(load).muzzleVelocity
  const dv = (sigma: number) => hot(load, sigma).muzzleVelocity / v0 - 1
  const invert = (target: number) => {
    let [lo, hi] = [-0.01, 0.03]
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2
      if (dv(mid) < target) lo = mid
      else hi = mid
    }
    return (lo + hi) / 2
  }
  const sigmas = rows.map(([, form, cool, warm]) => ({ form, sigma: invert(warm / cool - 1) }))
  const extruded = stats(sigmas.filter((s) => s.form === 'extruded').map((s) => s.sigma))
  const all = stats(sigmas.map((s) => s.sigma))
  const f = (x: number) => x.toFixed(5)
  console.log(
    `| ${charge * 1000} g | ${v0.toFixed(0)} m/s | ${(100 * dv(0.0025)).toFixed(2)} % | ${f(extruded.mean)}, ${f(extruded.sd)} | ${f(all.mean)}, ${f(all.sd)} |`,
  )
}
