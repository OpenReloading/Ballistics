import type {
  ChronographString,
  InteriorLoad,
  PowderConfidence,
  PowderFit,
  PowderFitOptions,
  PowderFitReason,
  PowderPrediction,
  PowderPressureRange,
} from '@rangefoundry/ballistics'
import { msg } from '../i18n/translate.ts'

/** `parameters` are the values asked for. */
export interface PowderFitRequest {
  id: number
  load: InteriorLoad
  strings: ChronographString[]
  options?: PowderFitOptions | undefined
  /** Fit the values asked for although the ladder is thin or one of them moves with the burn coefficient. */
  anyway?: boolean | undefined
}

/** `sensitivity` in 1/K below and above the load's propellant temperature; `load` itself without a value above 0. */
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

/** `one`: one powder temperature; `sensitivity`: two or more but no sensitivity on the load. */
export function temperatureFit(load: InteriorLoad, strings: readonly ChronographString[]) {
  const temperatures = new Set(
    strings.map((s) => s.propellantTemperature ?? load.propellantTemperature),
  )
  const t = load.propellant.temperatureSensitivity
  if (temperatures.size < 2) return 'one'
  return t && (t.cold !== 0 || t.hot !== 0) ? 'fit' : 'sensitivity'
}

/** In order: the fit and its band, then the range; a refused fit or a failure ends the answer, after the fit when the range failed. */
export type PowderFitReply =
  /** Why the burn coefficient was fitted alone. */
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

/** One value per parameter of `fit`, in its order; `charges` in kg. */
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

/** A new request ends the running worker, so only the last answer reaches `show`. */
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
        // a worker whose script failed to load answers nothing: the next run starts a new one
        w.onerror = () => {
          w.terminate()
          worker = undefined
          set({
            failure: {
              kind: 'error',
              id: last,
              message: msg('The fit could not run in this browser.'),
            },
            running: false,
          })
        }
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

/** One at a time, only the last request waiting; a failed worker is replaced. */
export function handCurveRunner(
  create: () => Worker,
  show: (curve: HandPoint[] | undefined) => void,
) {
  let worker: Worker | undefined
  let id = 0
  // replies to requests up to this id are dropped: the values went back to the fit after them
  let dropped = 0
  let busy = false
  let next: Omit<PowderHandRequest, 'kind' | 'id'> | undefined
  const send = (r: Omit<PowderHandRequest, 'kind' | 'id'>) => {
    busy = true
    next = undefined
    if (!worker) {
      const w = create()
      w.onmessage = (e: MessageEvent<PowderHandReply>) => {
        if (e.data.id > dropped) show(e.data.curve)
        done()
      }
      w.onerror = () => {
        w.terminate()
        worker = undefined
        done()
      }
      worker = w
    }
    worker.postMessage({ ...r, kind: 'hand', id: ++id } satisfies PowderHandRequest)
  }
  const done = () => {
    busy = false
    if (next) send(next)
  }
  return {
    ask(r: Omit<PowderHandRequest, 'kind' | 'id'> | undefined) {
      if (!r) {
        dropped = id
        next = undefined
        show(undefined)
      } else if (busy) next = r
      else send(r)
    },
    stop() {
      worker?.terminate()
      worker = undefined
    },
  }
}
