/** The bullet picker's mass range: "150-180gr", "9.5-g", and the grams or grains it compares in. */
import { fromSi } from '@open-reloading/schema'
import { kilogramsPerGrain } from './units.ts'

/** Digits with at most one point, either part may be empty. */
const number = /^\d*(?:\.\d*)?$/

/**
 * A mass range of the text ("150-180gr", "9.5-g"), undefined when it does not parse or names no
 * known unit. Either bound may be left out.
 */
export function massRange(text: string) {
  const t = text.trim()
  const unit = (['gr', 'g'] as const).find((u) => t.endsWith(u))
  if (!unit) return
  const bounds = t.slice(0, -unit.length).split('-')
  if (bounds.length !== 2) return
  const [lo, hi] = bounds.map((s) => s.trim())
  if (!number.test(lo) || !number.test(hi)) return
  // "." alone is no number: no bound
  const n = (s: string) => (s && s !== '.' ? Number(s) : undefined)
  const [min, max] = [n(lo), n(hi)]
  if (min === undefined && max === undefined) return
  return { min, max, unit }
}

const gramsPer = { g: 1, gr: fromSi('mass', kilogramsPerGrain) }
/** Decimals a mass shows with, and is compared at, in the list. */
const massDigits = { gr: 1, g: 2 }

/** A mass `x` in `from` as `to` shows it: rounded to that unit's decimals. */
export const convertMass = (x: number, from: 'gr' | 'g', to: 'gr' | 'g') =>
  Number(((x * gramsPer[from]) / gramsPer[to]).toFixed(massDigits[to]))
