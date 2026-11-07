// Velocity units of export files and the conversion to stored m/s.
import type { QuantityValue } from '@open-reloading/schema'
import { conversions } from '@open-reloading/units'
import { type ChronoDiagnostic, refuse } from './diagnostics.ts'
import { parseNumber } from './text.ts'

/** A velocity unit the importers recognise. Parsed velocities are stored in m/s. */
export type VelocityUnit = 'ft/s' | 'm/s' | 'km/h' | 'mph'

/** `fps`, `ft/s`, `mps`, `m/s`, `kph`, `km/h` or `mph` in any case, else undefined. */
export function parseVelocityUnit(text: string | undefined): VelocityUnit | undefined {
  const t = text?.trim().toLowerCase()
  if (t === 'fps' || t === 'ft/s') return 'ft/s'
  if (t === 'mps' || t === 'm/s') return 'm/s'
  if (t === 'kph' || t === 'km/h') return 'km/h'
  if (t === 'mph') return 'mph'
  return undefined
}

// m/s per unit; the customary ones from the conversion table
const toMps: Record<VelocityUnit, number> = {
  'm/s': 1,
  'ft/s': conversions.ft.factor,
  'km/h': 1 / 3.6,
  mph: conversions.mph.factor,
}

/** `x` rounded to 1e-6, which drops binary float noise of a unit conversion. */
const roundToMillionths = (x: number) => Math.round(x * 1e6) / 1e6

/** Throws when the caller names a unit other than the recognised `unit` the file names as `text`. */
function checkCallerUnit(
  text: string,
  unit: VelocityUnit,
  options: { velocityUnit?: VelocityUnit | undefined },
): void {
  const caller = options.velocityUnit
  if (caller && caller !== unit)
    refuse('unitDiffersFromCaller', { text: text.trim(), unit, caller })
}

/** The file's unit, else the caller's; throws when neither is known or they differ. */
export function resolveUnit(
  text: string | undefined,
  options: { velocityUnit?: VelocityUnit | undefined },
  warnings: ChronoDiagnostic[],
): VelocityUnit {
  const unit = parseVelocityUnit(text)
  if (text && unit) checkCallerUnit(text, unit, options)
  if (unit) return unit
  const shown = text?.trim()
  if (!options.velocityUnit)
    refuse(shown ? 'unknownUnit' : 'missingUnit', shown ? { text: shown } : {})
  const warning: ChronoDiagnostic = shown
    ? { code: 'unknownUnitNamedByCaller', params: { text: shown, unit: options.velocityUnit } }
    : { code: 'missingUnitNamedByCaller', params: { unit: options.velocityUnit } }
  const same = (w: ChronoDiagnostic) =>
    w.code === warning.code && w.params['text'] === warning.params['text']
  if (!warnings.some(same)) warnings.push(warning)
  return options.velocityUnit
}

/** A velocity in m/s; `raw` keeps the cell and the unit as written in the file. */
export function parseVelocity(
  cell: string,
  unitText: string | undefined,
  unit: VelocityUnit,
): QuantityValue {
  const n = parseNumber(cell)
  if (Number.isNaN(n)) refuse('velocityNotNumber', { cell: cell.trim() })
  if (n <= 0) refuse('velocityNotPositive', { cell: cell.trim() })
  const value = unit === 'm/s' ? n : roundToMillionths(n * toMps[unit])
  const raw = unitText?.trim() ? `${cell.trim()} ${unitText.trim()}` : cell.trim()
  return { value, raw }
}
