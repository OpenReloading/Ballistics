import { chargeLadder, type InteriorLoad, interior } from '@openreloading/core'
import { describe, expect, it } from 'vitest'
import { exampleInterior, exampleRecords, loadExample } from '../src/lib/example-data.ts'
import { exampleFields } from '../src/lib/examples.ts'
import { siValues } from '../src/lib/field-spec.ts'
import { interiorBody, interiorFields } from '../src/lib/interior-input.ts'
import {
  barrelTimeBand,
  barrelTimes,
  burnRateLabel,
  lotBody,
  lotFractionError,
  lotLabel,
  lotLoad,
  lots,
} from '../src/lib/lot-rows.ts'
import { presetUnits } from '../src/lib/units.ts'

const filled = exampleFields(interiorFields, exampleInterior, presetUnits('us'))
const { load } = interiorBody(siValues(filled), exampleRecords.cartridge.id)
const { steps, step, direction } = loadExample.ladder
const charges = chargeLadder(load.charge, step, steps, direction)

/** The run of a body's ladder, as the API runs it: one model run per charge. */
const ladderRuns = (body: ReturnType<typeof lotBody>) => {
  const { chargeStep, stepCount, direction: d } = body.ladder as NonNullable<typeof body.ladder>
  return chargeLadder(body.load.charge, chargeStep, stepCount, d).map((charge) => {
    const run = interior({ ...body.load, charge })
    if (run.valid === false) throw new Error(`run at ${charge} kg is invalid`)
    return run
  })
}

const at = (fraction: number) => ({
  low: ladderRuns(lotBody(load, charges, direction, 'low', fraction)),
  nominal: charges.map((charge) => {
    const run = interior({ ...load, charge })
    if (run.valid === false) throw new Error(`run at ${charge} kg is invalid`)
    return run
  }),
  high: ladderRuns(lotBody(load, charges, direction, 'high', fraction)),
})

describe('lot rows', () => {
  it('ask for the charges of the run', () => {
    const body = lotBody(load, charges, direction, 'high', 0.03)
    const asked = chargeLadder(
      body.load.charge,
      (body.ladder as NonNullable<typeof body.ladder>).chargeStep,
      steps,
      direction,
    )
    for (const [i, c] of asked.entries()) expect(c).toBeCloseTo(charges[i], 12)
  })

  it('scale the burn rate of the load alone', () => {
    const burn = (l: InteriorLoad) => l.propellant.burn
    const [slow, fast] = [lotLoad(load, 'low', 0.03), lotLoad(load, 'high', 0.03)]
    const b = burn(load)
    if (b.kind !== 'vivacity') throw new Error('the example burns by vivacity')
    expect(burn(fast)).toEqual({ ...b, vivacity: b.vivacity * 1.03 })
    expect(burn(slow)).toEqual({ ...b, vivacity: b.vivacity * 0.97 })
    expect({ ...fast, propellant: { ...fast.propellant, burn: b } }).toEqual(load)
  })

  it('name the cartridge for the limits when the run has one', () => {
    expect(lotBody(load, charges, direction, 'low', 0.03)).not.toHaveProperty('cartridge')
    expect(lotBody(load, charges, direction, 'low', 0.03, '308-win').cartridge).toBe('308-win')
  })

  for (const fraction of [0.03, 0.08]) {
    it(`raise velocity and peak pressure and shorten barrel time at +${fraction * 100} % in every row, lower them at the other lot`, () => {
      const { low, nominal, high } = at(fraction)
      expect(nominal).toHaveLength(steps)
      nominal.forEach((n, i) => {
        expect(high[i].muzzleVelocity).toBeGreaterThan(n.muzzleVelocity)
        expect(low[i].muzzleVelocity).toBeLessThan(n.muzzleVelocity)
        expect(high[i].peakBreechPressure).toBeGreaterThan(n.peakBreechPressure)
        expect(low[i].peakBreechPressure).toBeLessThan(n.peakBreechPressure)
        expect(high[i].barrelTime).toBeLessThan(n.barrelTime)
        expect(low[i].barrelTime).toBeGreaterThan(n.barrelTime)
      })
    })
  }

  it('widen with the percentage in every row', () => {
    const [small, large] = [at(0.02), at(0.06)]
    small.nominal.forEach((_, i) => {
      for (const quantity of ['muzzleVelocity', 'peakBreechPressure', 'barrelTime'] as const) {
        const spread = (r: ReturnType<typeof at>) =>
          Math.abs(r.high[i][quantity] - r.low[i][quantity])
        expect(spread(large)).toBeGreaterThan(spread(small))
      }
    })
  })

  it('check the typed percentage', () => {
    expect(lotFractionError(0.03)).toBeUndefined()
    expect(lotFractionError(undefined)).toMatch(/Enter/)
    expect(lotFractionError(0)).toMatch(/above 0/)
    expect(lotFractionError(0.6)).toMatch(/at most 50 %/)
  })

  it('name the rows by their burn rate', () => {
    expect(lotLabel('high', 0.03)).toBe('+3 %')
    expect(lotLabel('low', 0.025)).toBe('−2.5 %')
    expect(burnRateLabel(undefined, 0.03)).toBe('nominal')
    expect(lots).toEqual(['low', 'high'])
  })

  it('draw a band over the rows of a charge, only where all three have a result', () => {
    const t = barrelTimes(
      [
        { charge: 1, barrelTime: 1.0 },
        { charge: 2, barrelTime: 0.9 },
        { charge: 3, barrelTime: undefined },
      ],
      {
        low: [{ barrelTime: 1.1 }, { barrelTime: undefined }, { barrelTime: 1 }],
        high: [{ barrelTime: 0.9 }, { barrelTime: 0.8 }, { barrelTime: 0.8 }],
      },
    )
    expect(t.map(barrelTimeBand)).toEqual([[0.9, 1.1], undefined, undefined])
  })
})
