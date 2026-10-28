import type {
  ChronographString,
  InteriorLoad,
  PowderConfidence,
  PowderFit,
  PowderFitOptions,
  PowderFitReason,
  PowderPrediction,
  PowderPressureRange,
} from '@open-reloading/core'
import { msg } from '../i18n/translate.ts'

/**
 * A fit the tuning screen asks for: the start load, the strings and the options of `fitPowder`,
 * whose `parameters` are the values asked for.
 */
export interface PowderFitRequest {
  id: number
  load: InteriorLoad
  strings: ChronographString[]
  options?: PowderFitOptions | undefined
  /** Fit the values asked for although the ladder is thin or one of them moves with the burn coefficient. */
  anyway?: boolean | undefined
}

/**
 * `load` with the temperature sensitivity `sensitivity`, 1/K, below and above the load's propellant
 * temperature; `load` itself without a value above 0.
 */
export const withSensitivity = (
  load: InteriorLoad,
  sensitivity: number | undefined,
): InteriorLoad =>
  sensitivity && sensitivity > 0
    ? {
        ...load,
        propellant: {
          ...load.propellant,
          temperatureSensitivity: {
            reference: load.propellantTemperature,
            cold: sensitivity,
            hot: sensitivity,
          },
        },
      }
    : load

/**
 * Whether the strings fit the temperature factor: `one`, they are at one powder temperature;
 * `sensitivity`, at two or more, but the load's temperature sensitivity is 0 or absent; else `fit`.
 */
export function temperatureFit(load: InteriorLoad, strings: readonly ChronographString[]) {
  const temperatures = new Set(
    strings.map((s) => s.propellantTemperature ?? load.propellantTemperature),
  )
  const t = load.propellant.temperatureSensitivity
  if (temperatures.size < 2) return 'one'
  return t && (t.cold !== 0 || t.hot !== 0) ? 'fit' : 'sensitivity'
}

/**
 * The worker's answers to one request, in this order: the fit and its band, then the pressure
 * range and its label. A refused fit or a failure ends the answer, after the fit when the range failed.
 */
export type PowderFitReply =
  /**
   * `rule`: the burn coefficient was fitted alone instead of the values asked for, because the
   * ladder is thin, because another value moved with it (`held`) or because the strings did not
   * resolve the temperature factor (`temperature`).
   */
  | {
      kind: 'fit'
      id: number
      fit: PowderFit
      band: PowderPrediction[]
      rule?: 'thin' | 'held' | 'temperature' | undefined
    }
  | { kind: 'range'; id: number; range: PowderPressureRange; confidence: PowderConfidence }
  /** `fitPowder` refused the ladder; `charge`, kg, is the string at fault of `invalid`. */
  | { kind: 'refused'; id: number; reason: PowderFitReason; charge?: number | undefined }
  | { kind: 'error'; id: number; message: string }

/**
 * A hand-tuned curve the tuning screen asks for: the fitted load at `values`, one per parameter
 * of `fit` in its order, run at `charges`, kg.
 */
export interface PowderHandRequest {
  kind: 'hand'
  id: number
  fit: Pick<PowderFit, 'load' | 'parameters'>
  values: number[]
  charges: number[]
}

/** A point of a hand-tuned curve: charge, kg, and muzzle velocity, m/s. */
export type HandPoint = { charge: number; velocity: number }

/** The worker's answer to a hand-tuned request: the charges that ran, in order. */
export type PowderHandReply = { kind: 'curve'; id: number; curve: HandPoint[] }

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
