import type { Medium } from './layout.ts'
import type { LengthUnit } from './units.ts'

/**
 * `lay` cached per figure object, medium, text size and unit: the screen text size search, the
 * width and the model lay out the same figure at the same size, once is enough.
 */
export function layoutCache<F extends object, L>(
  lay: (figure: F, medium: Medium, em: number, unit: LengthUnit) => L,
) {
  const laidOut = new WeakMap<F, Map<string, L>>()
  return (figure: F, medium: Medium, em: number, unit: LengthUnit): L => {
    const key = `${medium} ${em} ${unit}`
    const cache = laidOut.get(figure) ?? new Map<string, L>()
    laidOut.set(figure, cache)
    const hit = cache.get(key)
    if (hit) return hit
    const laid = lay(figure, medium, em, unit)
    cache.set(key, laid)
    return laid
  }
}
