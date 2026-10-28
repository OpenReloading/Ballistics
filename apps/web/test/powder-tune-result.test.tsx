import {
  type ChronographString,
  type InteriorLoad,
  interior,
  type PowderPrediction,
  predictPowder,
} from '@open-reloading/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { reasonTexts, TuneNotes } from '../src/components/powder-tune.tsx'
import { nth } from '../src/lib/nth.ts'
import type { PowderFitReply, PowderFitState } from '../src/lib/powder-fit.ts'
import { answerPowderFit } from '../src/lib/powder-fit-answer.ts'
import { presetUnits, withUnit } from '../src/lib/units.ts'

/** Synthetic rifle load of the core fit tests: truth vivacity 0.45 1/s. */
const load = (vivacity = 0.45): InteriorLoad => ({
  chamber: { volume: 3.4e-6, boreArea: 3.75e-5, boreDiameter: 6.9e-3 },
  barrel: { length: 0.6, twist: 0.254 },
  bullet: { mass: 0.0095 },
  charge: 0.0028,
  propellant: {
    specificEnergy: 3.9e6,
    gamma: 1.23,
    density: 1600,
    covolume: 1e-3,
    burn: {
      kind: 'vivacity',
      vivacity,
      exponent: 1,
      referencePressure: 98066.5,
      form: { kind: 'twoStage', a: 0.8, m: 0.5, q: 0.5, z1: 0.8 },
    },
  },
  propellantTemperature: 294.15,
  ignitionPressure: 5e6,
  startPressure: 30e6,
})

const strings: ChronographString[] = [2.6e-3, 2.7e-3, 2.8e-3, 2.9e-3].map((charge, i) => {
  const r = interior({ ...load(), charge })
  if (!r.valid) throw new Error(r.reason)
  const v = r.muzzleVelocity + nth([1.5, -2, 0.5, 1], i)
  return { charge, velocities: [v - 3, v, v + 3] }
})

const replies: PowderFitReply[] = []
answerPowderFit({ id: 1, load: load(0.38), strings }, (r) => replies.push(r))
const [fitted, ranged] = replies
if (fitted?.kind !== 'fit' || ranged?.kind !== 'range') throw new Error('no fit')

const text = (state: PowderFitState) =>
  renderToStaticMarkup(
    <TuneNotes loaded={undefined} interior={load(0.38)} fit={state} />,
  ).replaceAll('&#x27;', "'")

describe('the result view of the tuning route', () => {
  const html = text({ fit: fitted, range: ranged, running: false })
  const system = presetUnits('metric-grains')
  const speed = (ms: number) => withUnit('velocity', system, ms)

  it('writes the band at both ends of the drawn range as predictPowder gives it there', () => {
    const ends = [nth(fitted.band, 0), nth(fitted.band, fitted.band.length - 1)]
    const sides = ['below', 'above']
    ends.forEach((end: PowderPrediction, i) => {
      const p = predictPowder(fitted.fit, end.charge)
      expect(end.extrapolation?.charge).toBe(sides[i])
      expect(html).toContain(
        `Unfired ${withUnit('charge', system, p.charge)} (${sides[i]} the ladder): ${speed(p.velocity.value)}, 90 % interval ${speed(p.velocity.lower)} to ${speed(p.velocity.upper)}`,
      )
    })
  })

  it('shows the fitted values, a residual per string, the chart and the band line', () => {
    expect(html).toContain('Fitted values')
    expect(html).toContain('Standard uncertainty')
    expect(html).toContain('Vivacity')
    expect(html.match(/<tr role="row">/g)?.length).toBe(2 + strings.length + 1)
    expect(html).toContain('Residual per charge')
    expect(html).toContain('role="img"')
    expect(html).toContain(
      'Band: uncertainty of the fitted parameters only, not model error. Simulation, not load data.',
    )
  })

  it('names every reason of the label in plain words, the trend as one the residuals may show', () => {
    const all = Object.keys(reasonTexts) as (keyof typeof reasonTexts)[]
    const state = {
      fit: fitted,
      range: { ...ranged, confidence: { ...ranged.confidence, reasons: all } },
      running: false,
    }
    const shown = text(state)
    for (const r of all) expect(shown).toContain(`<li>${reasonTexts[r]}</li>`)
    expect(reasonTexts['residual-trend']).toBe('Residuals may show a trend')
  })

  it('shows no band line before the fit has arrived', () => {
    expect(text({ running: true })).not.toContain('Band:')
  })
})
