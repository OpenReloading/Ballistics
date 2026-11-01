import { interiorBody } from '@open-reloading/api/compute'
import { firearmAction, powder } from '@open-reloading/schema'
import { fetchRecord } from './api-fetch.ts'
import type { CartridgeDetail } from './api-types.ts'
import {
  tuneActionKey,
  tuneBaseKey,
  tuneCartridgeKey,
  tuneLoadKey,
  tuneTableKey,
} from './powder-tune.ts'

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

/** The powder record handed over with the load for load `load`; undefined when there is none or it is not valid. */
export function readTuneBase(load: string) {
  try {
    const text = sessionStorage.getItem(tuneBaseKey(load))
    if (text === null) return
    const r = powder.safeParse(JSON.parse(text))
    return r.success ? r.data : undefined
  } catch {
    return
  }
}

/** The CIP table of the cartridge record handed over with the load for load `load`; undefined when there is none. */
export function readTuneTable(load: string) {
  try {
    const text = sessionStorage.getItem(tuneTableKey(load))
    const table: unknown = text === null ? undefined : JSON.parse(text)
    return typeof table === 'string' ? table : undefined
  } catch {
    return
  }
}

/** The `action` of the firearm the load links, handed over with the load for load `load`; undefined when there is none. */
export function readTuneAction(load: string) {
  try {
    const text = sessionStorage.getItem(tuneActionKey(load))
    if (text === null) return
    const r = firearmAction.safeParse(JSON.parse(text))
    return r.success ? r.data : undefined
  } catch {
    return
  }
}

/**
 * The CIP table of the cartridge record of the load handed over for load `load`: the table handed
 * over, else that of the cartridge record whose id was handed over while it was still loading,
 * fetched (as the workbench's run does); undefined when there is neither or the record has none.
 */
export async function tuneTable(load: string, signal?: AbortSignal) {
  const handed = readTuneTable(load)
  if (handed !== undefined) return handed
  let id: unknown
  try {
    const text = sessionStorage.getItem(tuneCartridgeKey(load))
    id = text === null ? undefined : JSON.parse(text)
  } catch {
    return
  }
  if (typeof id !== 'string') return
  const record = await fetchRecord<CartridgeDetail>('cartridges', id, signal).catch(() => undefined)
  return record?.table
}
