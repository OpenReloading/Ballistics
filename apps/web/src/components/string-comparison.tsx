import { compareSd } from '../lib/string-comparison.ts'
import type { StringStats } from '../lib/string-stats.ts'

/** The strings to compare: a name and statistics each; a string without statistics is skipped. */
export interface ComparedString {
  name: string
  stats: StringStats | undefined
}

/**
 * The strings two by two by the SD intervals: the string with the smaller SD, or that the
 * difference is smaller than the uncertainty, or that a string has too few shots to compare.
 */
export function StringComparison({ strings }: { strings: readonly ComparedString[] }) {
  const kept = strings.flatMap((s) => (s.stats ? [{ name: s.name, stats: s.stats }] : []))
  const pairs = kept.flatMap((a, i) =>
    kept.slice(i + 1).map((b, j) => [a, b, `${i}/${i + 1 + j}`] as const),
  )
  if (pairs.length === 0) return null
  return (
    <ul className="session-compare" aria-label="Comparison of the SD of the strings">
      {pairs.map(([a, b, key]) => {
        const c = compareSd(a.stats, b.stats)
        return (
          <li key={key}>
            {a.name} and {b.name}:{' '}
            {c === 'same'
              ? 'difference smaller than the uncertainty'
              : c === 'few'
                ? 'too few shots to compare'
                : `${c === 'first' ? a.name : b.name} has the smaller SD`}
          </li>
        )
      })}
    </ul>
  )
}
