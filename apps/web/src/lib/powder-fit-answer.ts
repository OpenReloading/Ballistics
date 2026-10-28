import {
  fitPowder,
  type PowderFit,
  PowderFitError,
  powderConfidence,
  powderPressureRange,
  predictPowder,
  stringLadder,
} from '@open-reloading/core'
import { errorText } from './error-text.ts'
import type { PowderFitReply, PowderFitRequest } from './powder-fit.ts'

/** Charges of the band: the ladder's range widened by 10 % each way, in 25 steps. */
export function bandCharges({ min, max }: PowderFit['chargeRange'], n = 25) {
  const lo = min * 0.9
  const hi = max * 1.1
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1))
}

/** Answers `q` through `post`: the fit and band as soon as they are known, then the slow pressure range. */
export function answerPowderFit(q: PowderFitRequest, post: (r: PowderFitReply) => void) {
  const { id } = q
  try {
    const ladder = stringLadder(q.strings)
    const fit = fitPowder(q.load, ladder, q.options)
    // a band charge outside the ladder may not run; the band leaves it out instead of refusing the fit
    const band = bandCharges(fit.chargeRange).flatMap((c) => {
      try {
        return [predictPowder(fit, c, { options: q.options?.options })]
      } catch (err) {
        if (err instanceof PowderFitError) return []
        throw err
      }
    })
    post({ kind: 'fit', id, fit, band })
    const range = powderPressureRange(fit, ladder, { fit: q.options })
    post({ kind: 'range', id, range, confidence: powderConfidence(fit, range) })
  } catch (err) {
    post(
      err instanceof PowderFitError
        ? { kind: 'refused', id, reason: err.reason, charge: err.charge }
        : { kind: 'error', id, message: errorText(err) },
    )
  }
}
