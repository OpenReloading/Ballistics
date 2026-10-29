// Doubling sensitivity of the bore resistance on a synthetic 76 mm proxy: every value below is a
// guess, not a measurement of a gun. The burn coefficient (default 1e-9 m s^-1 Pa^-1) puts the
// full-charge peak near 300 MPa with burnout in the bore. node spikes/360/sensitivity.mts [coefficient]
import { type InteriorLoad, interior } from '../../packages/core/dist/index.js'

const bore = 0.0762
const area = (Math.PI / 4) * bore ** 2
const coefficient = Number(process.argv[2] ?? 1e-9)
/** Guessed resistance: start pressure, engraving ramp over the band width, friction pressure, Pa and m. */
const guess = { start: 25e6, engraving: 40e6, band: 0.025, friction: 8e6 }
const full = 1.6

function gun(charge: number, engraving: number, friction: number): InteriorLoad {
  return {
    chamber: { volume: 2.2e-3, boreArea: area, boreDiameter: bore },
    barrel: { length: 40 * bore, twist: 0 },
    bullet: { mass: 6.2 },
    charge,
    propellant: {
      specificEnergy: 3.6e6,
      gamma: 1.24,
      density: 1600,
      covolume: 1e-3,
      burn: {
        kind: 'geometric',
        coefficient,
        exponent: 1,
        grain: { shape: 'tube', diameter: 0.006, perforationDiameter: 0.0015, length: 0.15 },
      },
    },
    propellantTemperature: 294.15,
    ignitionPressure: 1e6,
    startPressure: engraving * guess.start,
    resistance: {
      friction: friction * guess.friction,
      engraving: [
        { travel: 0, pressure: engraving * guess.engraving },
        { travel: guess.band, pressure: 0 },
      ],
    },
  }
}

const cases = [
  ['present', 1, 1],
  ['engraving x2', 2, 1],
  ['friction x2', 1, 2],
  ['both x2', 2, 2],
] as const
for (const charge of [full, 0.75 * full]) {
  const base = interior(gun(charge, 1, 1))
  for (const [name, e, f] of cases) {
    const run = interior(gun(charge, e, f))
    if (!run.valid || !base.valid) throw new Error(`${name}: ${run.valid ? '' : run.reason}`)
    console.log(
      [
        `${charge.toFixed(2)} kg`,
        name,
        `${(run.peakBreechPressure / 1e6).toFixed(0)} MPa`,
        `${run.muzzleVelocity.toFixed(0)} m/s`,
        `${((100 * (run.peakBreechPressure - base.peakBreechPressure)) / base.peakBreechPressure).toFixed(1)} %`,
        `${(run.muzzleVelocity - base.muzzleVelocity).toFixed(0)} m/s`,
        `burnout ${run.burnout ? 'in bore' : 'none'}`,
      ].join('\t'),
    )
  }
}
