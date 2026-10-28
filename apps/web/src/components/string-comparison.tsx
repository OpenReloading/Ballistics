import { useTranslation } from '../i18n/language.ts'
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
  const { t } = useTranslation()
  const kept = strings.flatMap((s) => (s.stats ? [{ name: s.name, stats: s.stats }] : []))
  const pairs = kept.flatMap((a, i) =>
    kept.slice(i + 1).map((b, j) => [a, b, `${i}/${i + 1 + j}`] as const),
  )
  if (pairs.length === 0) return null
  return (
    <ul className="session-compare" aria-label={t('Comparison of the SD of the strings')}>
      {pairs.map(([a, b, key]) => {
        const c = compareSd(a.stats, b.stats)
        return (
          <li key={key}>
            {c === 'same'
              ? t('{a} and {b}: difference smaller than the uncertainty', { a: a.name, b: b.name })
              : c === 'few'
                ? t('{a} and {b}: too few shots to compare', { a: a.name, b: b.name })
                : t('{a} and {b}: {smaller} has the smaller SD', {
                    a: a.name,
                    b: b.name,
                    smaller: c === 'first' ? a.name : b.name,
                  })}
          </li>
        )
      })}
    </ul>
  )
}
