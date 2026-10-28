/**
 * Measurements of the powder tuning prototype: `node apps/web/scripts/powder-tune-proto-measure.mts` after
 * `npm run build`. Prints one JSON object.
 */
import { fitPowder, PowderFitError, predictPowder } from '@open-reloading/core'
import {
  handTune,
  ladders,
  pointsOf,
  startVivacity,
  strings,
  syntheticLoad,
  thin,
  truthVivacity,
  tune,
} from '../src/lib/powder-tune-proto.ts'

const out: Record<string, unknown> = {}

// 1. every ladder: the reason or the fit
out.cases = ladders.map((l) => {
  const a = tune({ ladderId: l.id })
  return {
    id: l.id,
    thin: a.thin,
    used: a.used,
    refusal: a.refusal?.reason,
    burn: a.fit?.parameters.find((p) => p.name === 'burnRate'),
    label: a.fit?.label,
    halfWidth: a.fit?.halfWidth,
    held: a.held,
    ms: { fit: Math.round(a.ms.fit), band: Math.round(a.ms.band), range: Math.round(a.ms.range) },
  }
})

// 2. the screen's fit equals fitPowder on the same inputs
const good = ladders.find((l) => l.id === 'good')
if (!good) throw new Error('no good ladder')
const direct = fitPowder(syntheticLoad(startVivacity), pointsOf(good.strings, undefined))
const screen = tune({ ladderId: 'good' })
const dp = direct.parameters[0]
const sp = screen.fit?.parameters[0]
out.equality = {
  direct: dp?.value,
  screen: sp?.value,
  equal: dp?.value === sp?.value && dp?.standardUncertainty === sp?.sigma,
  residualsEqual:
    JSON.stringify(direct.residuals.map((r) => r.predicted)) ===
    JSON.stringify(screen.fit?.residuals.map((r) => r.predicted)),
}

// 3. round trip on the three ladders: truth against the fitted value and its interval
out.roundTrip = ['good', 'thin', 'velocity-only'].map((id) => {
  const a = tune({ ladderId: id })
  const p = a.fit?.parameters.find((x) => x.name === 'burnRate')
  const z = p?.sigma ? (p.value - truthVivacity) / p.sigma : undefined
  return {
    id,
    fitted: p?.value,
    sigma: p?.sigma,
    truth: truthVivacity,
    sigmasFromTruth: z,
    inside2Sigma: z === undefined ? undefined : Math.abs(z) <= 2,
  }
})

// 4. coverage over seeds: how often the 2 sigma interval holds the truth
function coverage(grams: number[], n: number) {
  let inside = 0
  let failed = 0
  const widths: number[] = []
  for (let seed = 1; seed <= n; seed++) {
    try {
      const s = strings(grams, 1000 + seed)
      const fit = fitPowder(syntheticLoad(startVivacity), pointsOf(s, undefined))
      const p = fit.parameters[0]
      if (!p?.standardUncertainty) continue
      widths.push((2 * p.standardUncertainty) / p.value)
      if (Math.abs(p.value - truthVivacity) <= 2 * p.standardUncertainty) inside++
    } catch (e) {
      if (!(e instanceof PowderFitError)) throw e
      failed++
    }
  }
  widths.sort((a, b) => a - b)
  return {
    n,
    inside,
    failed,
    coverage: inside / (n - failed),
    medianRelHalfWidth: widths[widths.length >> 1],
  }
}
out.coverage = {
  good5: coverage([2.6, 2.7, 2.81, 2.92, 3.04], 200),
  three_close: coverage([2.8, 2.84, 2.88], 200),
  thin2: coverage([2.7, 2.9], 200),
  one: coverage([2.8], 200),
}

// 5. redraw compute time of a slider move: 25 charges, the fitted load
const load = screen.fit?.load
if (!load) throw new Error('no fit')
const grams = screen.curve.map((c) => c.grams)
const times: number[] = []
for (let i = 0; i < 300; i++) {
  const v = (screen.fit?.parameters[0]?.value ?? 0.45) * (0.9 + 0.2 * (i / 300))
  times.push(handTune(load, { burnRate: v }, grams).runMs)
}
times.sort((a, b) => a - b)
out.sliderCompute = {
  charges: grams.length,
  medianMs: times[150],
  p95Ms: times[285],
  maxMs: times[299],
}

// 6. thin rule: what the rule changes on a 3-charge close ladder
const close = strings([2.8, 2.84, 2.88], 1)
out.thinRule = {
  thin: thin(close),
  predictAt: predictPowder(
    fitPowder(syntheticLoad(startVivacity), pointsOf(close, undefined)),
    0.0029,
  ).velocity,
}

console.log(JSON.stringify(out, null, 1))
