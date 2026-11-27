/** The validation message of a form field, in the language shown. */
import type { I18n } from '@lingui/core'
import { loadEnglish } from '../i18n/lingui.ts'
import { ambiguousMessage, parseNumber } from '../i18n/number.ts'
import type { Translator } from '../i18n/translate.ts'
import englishMessages from '../locales/en/lib/field-error.json' with { type: 'json' }
import { type FieldSpec, type FieldValue, rangeOf, specText } from './field-spec.ts'
import { parseTwist, type UnitSystem } from './units.ts'

loadEnglish(englishMessages)

const texts = {
  enterNumber: /*i18n*/ { id: 'fieldError.enterNumber', message: 'Enter a number for {label}.' },
  twist: /*i18n*/ { id: 'fieldError.twist', message: 'Enter a twist as 1:8 or 8.' },
  atLeast: /*i18n*/ {
    id: 'fieldError.atLeast',
    message: '{label} must be at least {min, decimal}{unit}.',
  },
  atMost: /*i18n*/ {
    id: 'fieldError.atMost',
    message: '{label} must be at most {max, decimal}{unit}.',
  },
  greaterThanZero: /*i18n*/ {
    id: 'fieldError.greaterThanZero',
    message: '{label} must be greater than 0{unit}.',
  },
  wholeNumber: /*i18n*/ {
    id: 'fieldError.wholeNumber',
    message: '{label} must be a whole number.',
  },
}

/** Undefined when valid; bounds inclusive in display units, as the HTML attributes; the message names the field's own unit, not the Settings, in the language of `i18n`, which is that of `t`. */
export function fieldError(
  spec: FieldSpec,
  value: FieldValue | undefined,
  shown: UnitSystem,
  t: Translator['t'],
  i18n: I18n,
): string | undefined {
  const text = value?.text.trim() ?? ''
  const label = specText(t, spec.label, i18n)
  const enterNumber = () => i18n._({ ...texts.enterNumber, values: { label } })
  if (text === '') return spec.required ? enterNumber() : undefined
  if (value?.si === undefined) {
    if (spec.quantity === 'twist') return i18n._(texts.twist)
    const p = parseNumber(text, rangeOf(spec))
    return p.kind === 'ambiguous' ? ambiguousMessage(p, t) : enterNumber()
  }
  const symbol = shown[spec.quantity].symbol
  const unit = symbol ? ` ${symbol}` : ''
  const x = spec.quantity === 'twist' ? (parseTwist(text) ?? Number.NaN) : Number(text)
  return rangeError(spec, label, x, unit, i18n)
}

/** The message of the first bound that the number `x` breaks, undefined when it holds them all. */
function rangeError(
  spec: FieldSpec,
  label: string,
  x: number,
  unit: string,
  i18n: I18n,
): string | undefined {
  if (spec.min !== undefined && x < spec.min)
    return i18n._({ ...texts.atLeast, values: { label, min: spec.min, unit } })
  if (spec.max !== undefined && x > spec.max)
    return i18n._({ ...texts.atMost, values: { label, max: spec.max, unit } })
  if (spec.positive && x <= 0) return i18n._({ ...texts.greaterThanZero, values: { label, unit } })
  if (spec.integer && !Number.isInteger(x))
    return i18n._({ ...texts.wholeNumber, values: { label } })
}
