import { defaultStartPressure, handgunBarrelLengthLimit } from '@open-reloading/core'
import { msg } from '../i18n/translate.ts'
import { storageName } from './edition.ts'
import { interiorFields } from './interior-input.ts'

/** `localStorage` key of the user's workbench defaults: JSON of the tuned values, SI. */
const defaultsKey = storageName('workbenchDefaults')

/**
 * Ambient and secondary workbench inputs with their cited default, SI: `source` names where the
 * value comes from, `effect` how it reaches the result.
 */
export const citedDefaults = {
  propellantTemperature: {
    si: 294.15,
    source: msg('CIP test conditions at 21 °C, CIP Decision XXXVI-15'),
    effect: 'no effect without temperature coefficients of the powder',
  },
  ignitionPressure: {
    si: 1e6,
    source: msg('assumption, no source'),
    effect: 'not covered by the pressure range',
  },
  startPressure: {
    si: defaultStartPressure(handgunBarrelLengthLimit).value,
    source: msg('approximate model default for barrels of 300 mm and longer'),
    effect: 'covered by the pressure range',
  },
} as const

export type DefaultKey = keyof typeof citedDefaults
export const defaultKeys = Object.keys(citedDefaults) as DefaultKey[]
/** The cited defaults, and the user's barrel length: no cited value, empty means by cartridge class. */
export type WorkbenchDefaults = Record<DefaultKey, number> & { barrelLength?: number | undefined }

const cited = () =>
  Object.fromEntries(defaultKeys.map((k) => [k, citedDefaults[k].si])) as WorkbenchDefaults

/** A usable default: finite, within the field's bounds; temperature (K) and ignition pressure above 0. */
export function validDefault(key: DefaultKey, si: unknown): si is number {
  const spec = interiorFields.find((s) => s.key === key) as { min?: number }
  if (typeof si !== 'number' || !Number.isFinite(si)) return false
  if (key !== 'startPressure' && si <= 0) return false
  return spec.min === undefined || si >= spec.min
}

/** The cited defaults with every valid stored value over them; anything unreadable is ignored. */
export function parseDefaults(text: string | null): WorkbenchDefaults {
  const d = cited()
  let stored: unknown
  try {
    stored = JSON.parse(text ?? '')
  } catch {
    return d
  }
  if (typeof stored !== 'object' || stored === null) return d
  for (const k of defaultKeys) {
    const v = (stored as Record<string, unknown>)[k]
    if (validDefault(k, v)) d[k] = v
  }
  const barrel = (stored as Record<string, unknown>).barrelLength
  if (typeof barrel === 'number' && Number.isFinite(barrel) && barrel > 0) d.barrelLength = barrel
  return d
}

/** The stored text of `d`: the values that differ from the cited ones; undefined when none does. */
export function defaultsText(d: WorkbenchDefaults): string | undefined {
  const tuned: [string, number][] = defaultKeys
    .filter((k) => d[k] !== citedDefaults[k].si)
    .map((k) => [k, d[k]])
  if (d.barrelLength !== undefined) tuned.push(['barrelLength', d.barrelLength])
  return tuned.length ? JSON.stringify(Object.fromEntries(tuned)) : undefined
}

/** The user's defaults; the cited ones when storage is empty or not available. */
export function readDefaults(): WorkbenchDefaults {
  try {
    return parseDefaults(localStorage.getItem(defaultsKey))
  } catch {
    return cited()
  }
}

export function storeDefaults(d: WorkbenchDefaults) {
  const text = defaultsText(d)
  try {
    if (text === undefined) localStorage.removeItem(defaultsKey)
    else localStorage.setItem(defaultsKey, text)
  } catch {}
}

/** `localStorage` key of the Run automatically switch: `off` when switched off, else absent. */
const autoRunKey = storageName('workbenchAutoRun')

/** The switch as set in this page load, kept when storage takes no write. */
let sessionAutoRun: boolean | undefined

/** Whether the workbench runs on its own after an input change; on when storage is empty or not available. */
export function readAutoRun(): boolean {
  if (sessionAutoRun !== undefined) return sessionAutoRun
  try {
    return localStorage.getItem(autoRunKey) !== 'off'
  } catch {
    return true
  }
}

export function storeAutoRun(on: boolean) {
  sessionAutoRun = on
  try {
    if (on) localStorage.removeItem(autoRunKey)
    else localStorage.setItem(autoRunKey, 'off')
  } catch {}
}
