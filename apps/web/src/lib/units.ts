import { waterDensityGramsPerCm3 } from '@open-reloading/core'
import type { PresetId, Quantity, UnitSystem } from '@open-reloading/locale-format'
import * as locale from '@open-reloading/locale-format'
import { fromSi, toSi } from '@open-reloading/schema'
import { parseNumber } from '../i18n/number.ts'
import { shownLanguage } from '../i18n/shown.ts'
import { type Message, msg } from '../i18n/translate.ts'

/**
 * The display unit tables and the unit formatting of `@open-reloading/locale-format`, in the
 * language shown, the factors the app converts with and the text of unit fields.
 */
export {
  localePreset,
  type PresetId,
  parseUnitChoice,
  presetFromLink,
  presetUnitIds,
  presetUnits,
  type Quantity,
  resolveUnits,
  type Unit,
  type UnitChoice,
  type UnitSystem,
  unitsOf,
} from '@open-reloading/locale-format'

/** The volume in m3 of `grams` of water: a water capacity as the records store it. */
export const waterVolume = (grams: number) =>
  toSi('mass', grams) / toSi('density', waterDensityGramsPerCm3)

/** The mass in g of the water that fills `m3`: the inverse of {@link waterVolume}. */
export const waterGrams = (m3: number) =>
  fromSi('mass', m3 * toSi('density', waterDensityGramsPerCm3))

// NIST SP 811 Appendix B.8; lb is 0.45359237 kg and standard gravity 9.80665 m/s2 (ICAO Doc 7488/3)
export const metersPerInch = 0.0254
export const metersPerFoot = 0.3048
export const metersPerYard = 0.9144
export const kilogramsPerGrain = 6.479891e-5
/** 1 mph in m/s. */
export const metersPerSecondPerMph = 0.44704
export const pascalsPerInHg = 3386.389
/** Water density, g/cm³ (defined in core): turns a water capacity in g or gr into a volume. */
export { waterDensityGramsPerCm3 }

const poundForce = 0.45359237 * 9.80665
export const psi = poundForce / metersPerInch ** 2
export const footPound = metersPerFoot * poundForce

export const presetNames: Record<PresetId, Message> = {
  'metric-grains': msg('Metric, common use'),
  us: msg('US customary'),
  'metric-grams': msg('Metric (SI)'),
}

/** The length unit of the technical drawings' labels: inches when lengths are shown in inches. */
export const drawingLengthUnit = (system: UnitSystem): 'mm' | 'in' =>
  system.length.symbol === 'in' ? 'in' : 'mm'

/** Stored decimal degrees (converted from degrees, minutes and seconds) to 4 decimals, trailing zeros dropped. */
export function degreeText(x: number): string {
  return String(Number(x.toFixed(4)))
}

/** `inchText` of `@open-reloading/locale-format` in the language shown. */
export const inchText = (text: string, symbol: string) =>
  locale.inchText(text, symbol, shownLanguage())

/** An SI value in the unit of `q` in `system`, without the symbol. */
export const formatQuantity = (q: Quantity, system: UnitSystem, si: number) =>
  locale.formatQuantity(q, system, si, shownLanguage())

/** A time in s as milliseconds with 3 decimals: "1.234 ms". */
export const msText = (s: number) => locale.msText(s, shownLanguage())

/** A fraction as a percentage with 1 decimal: "12.5 %". */
export const percentText = (fraction: number) => locale.percentText(fraction, shownLanguage())

/** An SI value in the unit of `q` in `system`, with the unit's symbol. */
export const withUnit = (q: Quantity, system: UnitSystem, si: number) =>
  locale.withUnit(q, system, si, shownLanguage())

/**
 * A twist as typed: "1:8", "1 in 8" or "8", one turn per
 * that many units of the field's length unit. Undefined for any other text.
 */
export function parseTwist(text: string): number | undefined {
  const m = /^\s*(?:1\s*(?::|in)\s*)?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/i.exec(text)
  return m ? Number(m[1]) : undefined
}

/**
 * The canonical text of a typed twist ("1:8,5" is "1:8.5", "8" and "1 in 8" as typed); undefined
 * when its number does not parse.
 */
export function typedTwist(raw: string): string | undefined {
  const t = raw.trimEnd()
  const lead = /^\s*(?:1\s*(?::|in)\s*)?/i.exec(t)?.[0] ?? ''
  const p = parseNumber(t.slice(lead.length))
  return p.kind === 'number' ? `${lead}${p.text}` : undefined
}

/** A twist's number as field text: "1:8"; 0 (no rifling) stays "0". */
const twistLabel = (n: string) => (Number(n) === 0 ? n : `1:${n}`)

/** The typed twist in the form the field shows it ("8" and "1 in 8" read "1:8"); undefined when invalid. */
export function twistTyped(text: string): string | undefined {
  const n = parseTwist(text)
  return n === undefined ? undefined : twistLabel(String(n))
}

/** An SI value as field text in the unit of `q` in `system`: 6 significant digits. */
export function exactFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const text = String(Number(system[q].fromSi(si).toPrecision(6)))
  return q === 'twist' ? twistLabel(text) : text
}

/**
 * An SI value as a workbench field shows it: `roundedFieldText` with its trailing zeros (37.0 gr,
 * 0.300 in), so the values of a card align by their decimals. A twist is as `roundedFieldText`.
 */
export function fixedFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const { fromSi, decimals } = system[q]
  const x = fromSi(si)
  if (q === 'twist' || x === 0 || !Number.isFinite(x)) return roundedFieldText(q, system, si)
  const d = Math.max(decimals, 2 - Math.floor(Math.log10(Math.abs(x))))
  return x.toFixed(Math.min(d, 12))
}

/**
 * An SI value as a calculator field shows it (38.3 gr, not 38.2722): the
 * unit's display decimals, at least three significant digits, no trailing zeros. The field keeps
 * the exact SI value beside the text and a unit switch converts from it, so nothing drifts. The
 * designers use it too: no six-decimal inches beside a drawing in mm.
 */
export function roundedFieldText(q: Quantity, system: UnitSystem, si: number): string {
  const { fromSi, decimals } = system[q]
  const x = fromSi(si)
  if (x === 0 || !Number.isFinite(x)) return String(x)
  const d = Math.max(decimals, 2 - Math.floor(Math.log10(Math.abs(x))))
  const text = String(Number(x.toFixed(Math.min(d, 12))))
  return q === 'twist' ? twistLabel(text) : text
}

/** A length in the display unit of `system` with the workbench decimals of its kind, without the symbol. */
export const lengthText = (kind: locale.LengthKind, system: UnitSystem, si: number) =>
  locale.lengthText(kind, system, si, shownLanguage())

/** A length in the display unit of `system` with the workbench decimals of its kind, and the symbol. */
export const shownLength = (kind: locale.LengthKind, system: UnitSystem, si: number) =>
  locale.shownLength(kind, system, si, shownLanguage())

/** A length given in mm in the display unit of `system`, with the symbol. */
export const mmLength = (system: UnitSystem, mm: number) =>
  shownLength('diameter', system, toSi('length', mm))
