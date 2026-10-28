import type { InteriorLoad } from '@open-reloading/core'
import { useEffect, useRef, useState } from 'react'
import { type PowderFitState, powderFitRunner } from '../lib/powder-fit.ts'
import { fitStrings, type TuneString } from '../lib/powder-tune.ts'

/**
 * The fit of `strings` from `load` in a worker of the page, with each part as it arrives. Every
 * change of the strings or the load asks again and drops the running answer; no load, no fit.
 */
export function usePowderFit(load: InteriorLoad | undefined, strings: readonly TuneString[]) {
  const [state, setState] = useState<PowderFitState>({ running: false })
  const runner = useRef<ReturnType<typeof powderFitRunner> | undefined>(undefined)
  useEffect(() => {
    const r = powderFitRunner(
      () => new Worker(new URL('../lib/powder-fit.worker.ts', import.meta.url), { type: 'module' }),
      setState,
    )
    runner.current = r
    return () => r.stop()
  }, [])
  useEffect(() => {
    const ladder = fitStrings(strings)
    if (load && ladder.length > 0) runner.current?.run({ load, strings: ladder })
  }, [load, strings])
  return state
}
