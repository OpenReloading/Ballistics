import { interiorBody } from '@open-reloading/api/compute'
import { tuneLoadKey } from './powder-tune.ts'

/**
 * The load the workbench handed over for load `load` (a reference), parsed as the workbench's run
 * parses its body; undefined when there is none or it is not valid. Apart from `powder-tune.ts`, so
 * the workbench, which writes it, does not load the schema of the run.
 */
export function readTuneLoad(load: string) {
  try {
    const text = sessionStorage.getItem(tuneLoadKey(load))
    if (text === null) return
    const r = interiorBody.safeParse({ model: 'm3', load: JSON.parse(text) })
    return r.success ? r.data.load : undefined
  } catch {
    return
  }
}
