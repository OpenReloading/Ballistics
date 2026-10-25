/**
 * One matcher and one ranker for every list and picker (API, static edition, browser). A row's
 * search key is built once; a query is matched word by word, so the order of the words does not
 * matter.
 */

const SEP = '\u0001'

/** Search text of `s`: Unicode NFD, combining marks removed, lower case, a decimal comma a point. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/(\d),(?=\d)/g, '$1.')

const compact = (s: string) => s.replace(/[\s-]+/g, '')

/** The name without a dot that ends a word ("308 win." and "308 win" are the same name). */
const bare = (s: string) => compact(fold(s).replace(/\.(?=\s|$)/g, ''))

/**
 * The key a row is searched by: the folded texts, the same with spaces and hyphens removed
 * ("8x57" finds "8 x 57 IS", "30 06" finds "30-06") and the folded `name` (default: the first
 * text) for the exact match.
 */
export function searchKey(texts: readonly (string | undefined)[], name = texts[0]): string {
  const joined = fold(texts.filter(Boolean).join(' '))
  return [joined, compact(joined), fold(name ?? '')].join(SEP)
}

const startsAt = (key: string, at: number) => at === 0 || key[at - 1] === ' ' || key[at - 1] === SEP

const isDigit = (c: string | undefined) => c !== undefined && c >= '0' && c <= '9'

/** A typed number: digits with an optional decimal part and an optional leading point (".308"). */
const NUMBER = /^\.?\d+(?:\.\d+)?$/

/** Whether the `length` characters of the key at `at` are a number of their own: no digit before or after, no part of a longer decimal. */
function wholeNumber(key: string, at: number, length: number) {
  const [before, beforeThat] = [key[at - 1], key[at - 2]]
  const [after, afterThat] = [key[at + length], key[at + length + 1]]
  if (isDigit(before) || (before === '.' && isDigit(beforeThat))) return false
  return !(isDigit(after) || (after === '.' && isDigit(afterThat)))
}

/**
 * 2 where the best occurrence of `alternative` starts a word of the key, 1 elsewhere, 0 if none;
 * with `whole` only occurrences that are a whole number count.
 */
function occurrence(key: string, alternative: string, whole: boolean) {
  let found = 0
  for (let at = key.indexOf(alternative); at >= 0; at = key.indexOf(alternative, at + 1)) {
    if (whole && !wholeNumber(key, at, alternative.length)) continue
    if (startsAt(key, at)) return 2
    found = 1
  }
  return found
}

/**
 * The rank of `query` in a row's search key, higher is better, `undefined` when a word of the
 * query occurs nowhere in the key (an empty query ranks 0). Per word: 2 at the start of a word, 1
 * inside one; the word may be written with or without spaces and hyphens and a number with or
 * without its leading point (".308"). A word that is a number matches whole numbers only: "7.8"
 * finds neither "17.82 g" nor "7.82 g", "168" neither "1682" nor "168.5", so a number typed so
 * far finds nothing until it is complete. 4 more when the whole query is the row's name.
 */
export function score(key: string, query: string): number | undefined {
  const words = fold(query).split(/\s+/).filter(Boolean)
  let total = 0
  for (const word of words) {
    const bareWord = compact(word)
    if (!bareWord) continue
    const whole = NUMBER.test(word)
    const best = Math.max(
      occurrence(key, word, whole),
      occurrence(key, bareWord, whole),
      /^\.\d/.test(word) ? occurrence(key, word.slice(1), whole) : 0,
    )
    if (!best) return undefined
    total += best
  }
  const name = key.slice(key.lastIndexOf(SEP) + 1)
  return words.length && bare(words.join(' ')) === bare(name) ? total + 4 : total
}
