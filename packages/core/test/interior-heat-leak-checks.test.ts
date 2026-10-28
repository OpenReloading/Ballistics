/**
 * Informational comparison of the convective heat-loss model with published gun figures and of the leak model
 * with published mortar figures (`apps/docs/docs/research/heat-loss-gun-bores.md`,
 * `apps/docs/docs/research/leak-mortar-clearance.md`). The proxies are synthetic loads; the reference figures are
 * unverified. Nothing here retunes a default: the assertions only check that the runs are valid and the tables
 * are finite. Print the tables with `npx vitest run test/interior-heat-leak-checks.test.ts --silent=false`.
 */
import { describe, expect, it } from 'vitest'
import { type InteriorLoad, type InteriorRun, interior, solveCharge } from '../src/index.ts'
import { m3Load } from './fixtures.ts'

const check = (load: InteriorLoad): InteriorRun => {
  const run = interior(load)
  if (!run.valid) throw new Error(run.reason)
  return run
}

// Heat: 203 mm gun, shot 119.5 kg, travel 43 calibres, one chamber for every charge.
const gunBore = 0.203
const gunArea = (Math.PI / 4) * gunBore ** 2
const gunEnergy = 3.6e6
/** Detailed-result losses (MJ) and shares (percent) at each charge (kg), from the issue text, unverified. */
const heatReference = [
  { charge: 13.6, heat: 3.4, share: 6.9 },
  { charge: 20.3, heat: 4.22, share: 5.7 },
  { charge: 25.1, heat: 4.64, share: 5.2 },
  { charge: 29.5, heat: 4.99, share: 4.7 },
]
/** Burn coefficients (m s^-1 Pa^-1) of the synthetic cord; the first is the one of the verdict. */
const cordCoefficients = [1.4e-9, 1e-9, 2e-9]

function gun(charge: number, coefficient: number, calibres = 43): InteriorLoad {
  return {
    chamber: { volume: 0.06, boreArea: gunArea, boreDiameter: gunBore },
    barrel: { length: calibres * gunBore, twist: 0 },
    bullet: { mass: 119.5 },
    charge,
    propellant: {
      specificEnergy: gunEnergy,
      gamma: 1.24,
      density: 1600,
      covolume: 1e-3,
      burn: {
        kind: 'geometric',
        coefficient,
        exponent: 1,
        grain: { shape: 'tube', diameter: 0.012, perforationDiameter: 0.003, length: 0.3 },
      },
    },
    propellantTemperature: 294.15,
    ignitionPressure: 1e6,
    startPressure: 2e7,
    heat: { model: 'convective', flameTemperature: 2800 },
  }
}

/** Log-log slope of y over x. */
function exponent(x: number[], y: number[]): number {
  const [lx, ly] = [x.map(Math.log), y.map(Math.log)]
  const [mx, my] = [lx.reduce((a, b) => a + b) / lx.length, ly.reduce((a, b) => a + b) / ly.length]
  return (
    lx.reduce((s, v, i) => s + (v - mx) * ((ly[i] ?? 0) - my), 0) /
    lx.reduce((s, v) => s + (v - mx) ** 2, 0)
  )
}

describe('heat loss of the convective model against the 203 mm gun figures', () => {
  for (const coefficient of cordCoefficients) {
    it(`cord burn coefficient ${coefficient}`, () => {
      const rows = heatReference.map((ref) => {
        const run = check(gun(ref.charge, coefficient))
        const heat = run.energy.heat / 1e6
        return {
          charge: ref.charge,
          peakMPa: +(run.peakBreechPressure / 1e6).toFixed(0),
          muzzle: +run.muzzleVelocity.toFixed(0),
          heatMJ: +heat.toFixed(2),
          refMJ: ref.heat,
          ratio: +(heat / ref.heat).toFixed(2),
          sharePct: +((100 * run.energy.heat) / (ref.charge * gunEnergy)).toFixed(2),
          refSharePct: ref.share,
        }
      })
      const charges = heatReference.map((r) => r.charge / 119.5)
      console.table(rows)
      console.log(
        `coefficient ${coefficient}: heat ~ (charge/shot)^${exponent(
          charges,
          rows.map((r) => r.heatMJ),
        ).toFixed(2)}, reference ^${exponent(
          charges,
          heatReference.map((r) => r.heat),
        ).toFixed(2)}`,
      )
      for (const r of rows) expect(Number.isFinite(r.ratio) && r.heatMJ > 0).toBe(true)
    })
  }

  it('rifle-like proxy at 43, 87 and 130 calibres of travel', () => {
    const bore = m3Load.chamber.boreDiameter
    const rows = [43, 87, 130].map((calibres) => {
      const run = check({
        ...m3Load,
        barrel: { length: calibres * bore, twist: 0 },
        heat: { model: 'convective', flameTemperature: 2900 },
      })
      return {
        calibres,
        muzzle: +run.muzzleVelocity.toFixed(0),
        heatJ: +run.energy.heat.toFixed(0),
        sharePct: +(
          (100 * run.energy.heat) /
          (m3Load.charge * m3Load.propellant.specificEnergy)
        ).toFixed(1),
      }
    })
    console.table(rows)
    expect(rows.every((r) => r.heatJ > 0)).toBe(true)
  })
})

// Leak: 81 mm smooth-bore mortar, shot 3.3 kg, travel 1.2 m.
const mortarBore = 0.081
const mortarArea = (Math.PI / 4) * mortarBore ** 2
const inch = 0.0254
const feet = 0.3048
const velocities = [100, 150, 200, 250]
/** Burn coefficients (m s^-1 Pa^-1) of the synthetic mortar powder; the first is the one of the verdict. */
const mortarCoefficients = [1e-8, 3e-9]

function mortar(coefficient: number): InteriorLoad {
  return {
    chamber: { volume: 1.5e-3, boreArea: mortarArea, boreDiameter: mortarBore },
    barrel: { length: 1.2, twist: 0 },
    bullet: { mass: 3.3 },
    charge: 0.1,
    propellant: {
      specificEnergy: 3.6e6,
      gamma: 1.24,
      density: 1600,
      covolume: 1e-3,
      burn: {
        kind: 'geometric',
        coefficient,
        exponent: 1,
        grain: { shape: 'tube', diameter: 0.004, perforationDiameter: 0.001, length: 0.006 },
      },
    },
    propellantTemperature: 294.15,
    ignitionPressure: 1e6,
    startPressure: 1e6,
  }
}

/** Muzzle-velocity loss (ft/s) for `clearance` m on the diameter, reduced to 80 mm: the loss scales with 2 clearance over diameter, so it is multiplied by 81/80. */
function loss(base: InteriorLoad, charge: number, clearance: number, discharge: number): number {
  const load = { ...base, charge }
  const area = (mortarArea * 2 * clearance) / mortarBore
  const leaking = check({
    ...load,
    leakage: {
      area: [
        { travel: 0, area },
        { travel: base.barrel.length, area },
      ],
      discharge,
    },
  })
  return ((check(load).muzzleVelocity - leaking.muzzleVelocity) * (mortarBore / 0.08)) / feet
}

describe('leak model against the mortar clearance figures', () => {
  for (const coefficient of mortarCoefficients) {
    it(`mortar burn coefficient ${coefficient}`, () => {
      const base = mortar(coefficient)
      const rows = velocities.map((target) => {
        const solved = solveCharge(base, { kind: 'muzzleVelocity', value: target })
        if (!solved.reached) throw new Error(solved.reason)
        const [charge, run] = [solved.charge, solved.run]
        const [l083, l1, half] = [
          loss(base, charge, 0.001 * inch, 0.83),
          loss(base, charge, 0.001 * inch, 1),
          loss(base, charge, 0.0005 * inch, 0.83),
        ]
        return {
          target,
          charge: +charge.toFixed(3),
          peakMPa: +(run.peakBreechPressure / 1e6).toFixed(0),
          loss083: +l083.toFixed(2),
          ratio083: +(l083 / 1.6).toFixed(2),
          loss1: +l1.toFixed(2),
          ratio1: +(l1 / 1.6).toFixed(2),
          linearity: +(half / (l083 / 2)).toFixed(3),
        }
      })
      console.table(rows)
      for (const r of rows) expect(r.loss083 > 0 && r.loss1 > r.loss083).toBe(true)
    })
  }
})
