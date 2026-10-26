// Velocity units of export files and the conversion to stored m/s.
import type { QuantityValue } from '@open-reloading/schema'
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

// m/s per unit, exact by definition (NIST SP 811, Appendix B.9)
const toMps: Record<VelocityUnit, number> = {
  'm/s': 1,
  'ft/s': 0.3048,
  'km/h': 1 / 3.6,
  mph: 0.44704,
}

/** `x` rounded to 1e-6, which drops binary float noise of a unit conversion. */
const roundToMillionths = (x: number) => Math.round(x * 1e6) / 1e6

/** End of the warning that a velocity unit named by the caller was used. */
export const namedByCaller = (unit: VelocityUnit) => `using ${unit} as named by the caller`

/** Throws when the caller names a unit other than the recognised `unit` the file names as `text`. */
function checkCallerUnit(
  text: string,
  unit: VelocityUnit,
  options: { velocityUnit?: VelocityUnit | undefined },
): void {
  const caller = options.velocityUnit
  if (caller && caller !== unit) {
    throw new Error(
      `velocity unit "${text.trim()}" (${unit}) in the file differs from ${caller} named by the caller`,
    )
  }
}

/** The file's unit, else the caller's; throws when neither is known or they differ. */
export function resolveUnit(
  text: string | undefined,
  options: { velocityUnit?: VelocityUnit | undefined },
  warnings: string[],
): VelocityUnit {
  const unit = parseVelocityUnit(text)
  if (text && unit) checkCallerUnit(text, unit, options)
  if (unit) return unit
  const shown = text?.trim() ? `"${text.trim()}"` : 'missing'
  if (!options.velocityUnit) {
    throw new Error(`velocity unit ${shown} is unknown; name the unit to import this file`)
  }
  const message = `velocity unit ${shown} in the file; ${namedByCaller(options.velocityUnit)}`
  if (!warnings.includes(message)) warnings.push(message)
  return options.velocityUnit
}

/** A velocity in m/s; `raw` keeps the cell and the unit as written in the file. */
export function parseVelocity(
  cell: string,
  unitText: string | undefined,
  unit: VelocityUnit,
): QuantityValue {
  const n = parseNumber(cell)
  if (Number.isNaN(n)) throw new Error(`velocity "${cell.trim()}" is not a number`)
  if (n <= 0) throw new Error(`velocity "${cell.trim()}" is not positive`)
  const value = unit === 'm/s' ? n : roundToMillionths(n * toMps[unit])
  const raw = unitText?.trim() ? `${cell.trim()} ${unitText.trim()}` : cell.trim()
  return { value, raw }
}
