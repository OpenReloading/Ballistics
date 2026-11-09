import type { InteriorLoad, PowderParameter } from '@open-reloading/ballistics'
import { useEffect, useRef, useState } from 'react'
import {
  type HandPoint,
  handCurveRunner,
  type PowderFitState,
  type PowderHandRequest,
  powderFitRunner,
  temperatureFit,
} from '../lib/powder-fit.ts'
import { fitStrings, type TuneString } from '../lib/powder-tune.ts'

const fitWorker = () =>
  new Worker(new URL('../lib/powder-fit.worker.ts', import.meta.url), { type: 'module' })

/** `anyway` lifts the thin and held rules; strings at two or more temperatures fit the temperature factor where the load has a sensitivity; every change drops the running answer. */
export function usePowderFit(
  load: InteriorLoad | undefined,
  strings: readonly TuneString[],
  anyway = false,
) {
  const [state, setState] = useState<PowderFitState>({ running: false })
  const runner = useRef<ReturnType<typeof powderFitRunner> | undefined>(undefined)
  useEffect(() => {
    const r = powderFitRunner(fitWorker, setState)
    runner.current = r
    return () => r.stop()
  }, [])
  useEffect(() => {
    const ladder = fitStrings(strings)
    if (!load || ladder.length === 0) return
    const options =
      temperatureFit(load, ladder) === 'fit'
        ? { parameters: ['burnRate', 'temperatureFactor'] as PowderParameter[] }
        : undefined
    runner.current?.run({ load, strings: ladder, options, anyway })
  }, [load, strings, anyway])
  return state
}

/** Undefined without `q`; a move while a run is out waits for it, and only the last move waiting runs next. */
export function useHandCurve(q: Omit<PowderHandRequest, 'kind' | 'id'> | undefined) {
  const [curve, setCurve] = useState<HandPoint[]>()
  const runner = useRef<ReturnType<typeof handCurveRunner> | undefined>(undefined)
  useEffect(() => {
    const r = handCurveRunner(fitWorker, setCurve)
    runner.current = r
    return () => r.stop()
  }, [])
  useEffect(() => runner.current?.ask(q), [q])
  return q ? curve : undefined
}
