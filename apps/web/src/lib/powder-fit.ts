import {
  type ChronographString,
  fitPowder,
  type InteriorLoad,
  type PowderConfidence,
  type PowderFit,
  PowderFitError,
  type PowderFitOptions,
  type PowderFitReason,
  type PowderPrediction,
  type PowderPressureRange,
  powderConfidence,
  powderPressureRange,
  predictPowder,
  stringLadder,
} from '@open-reloading/core'
import { msg } from '../i18n/translate.ts'
import { errorText } from './error-text.ts'

/** A fit the tuning screen asks for: the start load, the strings and the options of `fitPowder`. */
export interface PowderFitRequest {
  id: number
  load: InteriorLoad
  strings: ChronographString[]
  options?: PowderFitOptions | undefined
}

/**
 * The worker's answers to one request, in this order: the fit and its band, then the pressure
 * range and its label. A refused fit or a failure ends the answer, after the fit when the range failed.
 */
export type PowderFitReply =
  | { kind: 'fit'; id: number; fit: PowderFit; band: PowderPrediction[] }
  | { kind: 'range'; id: number; range: PowderPressureRange; confidence: PowderConfidence }
  /** `fitPowder` refused the ladder; `charge`, kg, is the string at fault of `invalid`. */
  | { kind: 'refused'; id: number; reason: PowderFitReason; charge?: number | undefined }
  | { kind: 'error'; id: number; message: string }

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

/** What the screen shows of the last request: each part once it has arrived. */
export interface PowderFitState {
  fit?: Extract<PowderFitReply, { kind: 'fit' }>
  range?: Extract<PowderFitReply, { kind: 'range' }>
  failure?: Extract<PowderFitReply, { kind: 'refused' | 'error' }>
  /** Whether the answer is still being worked out. */
  running: boolean
}

/**
 * Runs requests in a worker made by `create`. A new request while one runs ends that worker and
 * starts another, so only the answer to the last request reaches `show`.
 */
export function powderFitRunner(create: () => Worker, show: (s: PowderFitState) => void) {
  let worker: Worker | undefined
  let state: PowderFitState = { running: false }
  let last = 0
  const set = (s: PowderFitState) => {
    state = s
    show(s)
  }
  return {
    run(q: Omit<PowderFitRequest, 'id'>) {
      if (state.running) {
        worker?.terminate()
        worker = undefined
      }
      if (!worker) {
        const w = create()
        w.onmessage = (e: MessageEvent<PowderFitReply>) => {
          const r = e.data
          if (r.id !== last) return
          if (r.kind === 'fit') set({ fit: r, running: true })
          else if (r.kind === 'range') set({ ...state, range: r, running: false })
          else set({ ...state, failure: r, running: false })
        }
        w.onerror = () =>
          set({
            failure: {
              kind: 'error',
              id: last,
              message: msg('The fit could not run in this browser.'),
            },
            running: false,
          })
        worker = w
      }
      last++
      set({ running: true })
      worker.postMessage({ ...q, id: last })
    },
    stop() {
      worker?.terminate()
      worker = undefined
    },
  }
}
