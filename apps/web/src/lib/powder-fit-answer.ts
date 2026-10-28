import {
  fitPowder,
  fitPowderSessions,
  InputError,
  type InteriorLoad,
  interior,
  type LadderPoint,
  type PowderFit,
  PowderFitError,
  type PowderParameter,
  powderConfidence,
  powderConfidenceRules,
  powderPressureRange,
  predictPowder,
  stringLadder,
} from '@open-reloading/core'
import { errorText } from './error-text.ts'
import { nth } from './nth.ts'
import type {
  HandPoint,
  PowderFitReply,
  PowderFitRequest,
  PowderHandReply,
  PowderHandRequest,
} from './powder-fit.ts'

/** Charges of the band: the ladder's range widened by 10 % each way, in 25 steps. */
export function bandCharges({ min, max }: PowderFit['chargeRange'], n = 25) {
  const lo = min * 0.9
  const hi = max * 1.1
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
}

/**
 * Fewest distinct charges and smallest spread (largest over smallest charge, less 1) to fit the
 * values of `thinRule.values` besides the burn coefficient.
 */
const thinRule = {
  charges: 3,
  spread: 0.1,
  values: ['startPressure', 'volumeFactor'] as readonly PowderParameter[],
}

/** Whether `ladder` has too few charges, or too close ones, for the values of `thinRule.values`. */
function thinLadder(ladder: readonly LadderPoint[]) {
  const charges = [...new Set(ladder.map((p) => p.charge))]
  // a spread of exactly 10 % computes a hair below 0.1 in floating point
  return (
    charges.length < thinRule.charges ||
    Math.max(...charges) / Math.min(...charges) - 1 < thinRule.spread - 1e-9
  )
}

/** Whether a fitted value of `thinRule.values` moves with the burn coefficient beyond `powderConfidenceRules.correlation`. */
function heldFit(fit: PowderFit) {
  const burn = fit.parameters.findIndex((p) => p.name === 'burnRate')
  return fit.parameters.some(
    (p, j) =>
      thinRule.values.includes(p.name) &&
      Math.abs(fit.correlation?.[burn]?.[j] ?? 0) > powderConfidenceRules.correlation,
  )
}

/**
 * Answers `q` through `post`: the fit and band as soon as they are known, then the slow pressure
 * range. Unless `anyway`, a thin ladder leaves out the values of `thinRule.values`, and the burn
 * coefficient is fitted alone when a value asked for besides it moves with it (`held`): the core
 * fits such a value without refusing. On 2 charges every extra value moves with it, pressures or
 * not, so `anyway` lifts both rules. A temperature factor the strings do not resolve is held at 1
 * by `fitPowderSessions` (`temperature`) instead of refusing the fit.
 */
export function answerPowderFit(q: PowderFitRequest, post: (r: PowderFitReply) => void) {
  const { id } = q
  try {
    const ladder = stringLadder(q.strings)
    const asked = q.options?.parameters ?? ['burnRate']
    const thin = !q.anyway && asked.some((p) => thinRule.values.includes(p)) && thinLadder(ladder)
    let rule: 'thin' | 'held' | 'temperature' | undefined = thin ? 'thin' : undefined
    let parameters = thin ? asked.filter((p) => !thinRule.values.includes(p)) : asked
    const options = () => ({ ...q.options, parameters })
    let fit: PowderFit
    if (parameters.includes('temperatureFactor')) {
      const sessions = fitPowderSessions(q.load, [{ ladder }], options())
      if (!sessions.resolved.includes('temperatureFactor')) rule = 'temperature'
      parameters = sessions.resolved
      fit = sessions
    } else fit = fitPowder(q.load, ladder, options())
    if (!q.anyway && heldFit(fit)) {
      rule = 'held'
      parameters = ['burnRate']
      fit = fitPowder(q.load, ladder, options())
    }
    // a band charge outside the ladder may not run; the band leaves it out instead of refusing the fit
    const band = bandCharges(fit.chargeRange).flatMap((c) => {
      try {
        return [predictPowder(fit, c, { options: q.options?.options })]
      } catch (err) {
        if (err instanceof PowderFitError) return []
        throw err
      }
    })
    post({ kind: 'fit', id, fit, band, rule })
    const range = powderPressureRange(fit, ladder, { fit: options() })
    post({ kind: 'range', id, range, confidence: powderConfidence(fit, range) })
  } catch (err) {
    post(
      err instanceof PowderFitError
        ? { kind: 'refused', id, reason: err.reason, charge: err.charge }
        : { kind: 'error', id, message: errorText(err) },
    )
  }
}

/**
 * The fitted load of `fit` at `values`, one per fitted parameter in its order. The fitted load
 * already carries the fitted factors, so a factor scales it by its ratio to the fitted one.
 */
export function handLoad(fit: PowderHandRequest['fit'], values: readonly number[]): InteriorLoad {
  let l = fit.load
  fit.parameters.forEach((p, k) => {
    const v = nth(values, k)
    const ratio = v / p.value
    const pr = l.propellant
    if (p.name === 'burnRate')
      l = {
        ...l,
        propellant: {
          ...pr,
          burn:
            pr.burn.kind === 'vivacity'
              ? { ...pr.burn, vivacity: v }
              : { ...pr.burn, coefficient: v },
        },
      }
    else if (p.name === 'startPressure') l = { ...l, startPressure: v }
    else if (p.name === 'volumeFactor')
      l = { ...l, chamber: { ...l.chamber, volume: l.chamber.volume * ratio } }
    else if (p.name === 'energy') l = { ...l, propellant: { ...pr, specificEnergy: v } }
    else if (pr.temperatureSensitivity) {
      const t = pr.temperatureSensitivity
      l = {
        ...l,
        propellant: {
          ...pr,
          temperatureSensitivity: { ...t, cold: t.cold * ratio, hot: t.hot * ratio },
        },
      }
    }
  })
  return l
}

/** The muzzle velocity of the hand-tuned load at each charge of `q`; a charge that does not run is left out. */
export function handCurve(q: Omit<PowderHandRequest, 'kind' | 'id'>): HandPoint[] {
  const load = handLoad(q.fit, q.values)
  return q.charges.flatMap((charge) => {
    try {
      const r = interior({ ...load, charge })
      return r.valid ? [{ charge, velocity: r.muzzleVelocity }] : []
    } catch (err) {
      if (err instanceof InputError) return []
      throw err
    }
  })
}

/** Answers the hand-tuned request `q` through `post`. */
export const answerPowderHand = (q: PowderHandRequest, post: (r: PowderHandReply) => void) =>
  post({ kind: 'curve', id: q.id, curve: handCurve(q) })
