/** A number's canonical text has a point as the decimal mark and no grouping, what `Number(text)` reads, and is stored, linked, exported and computed with; only text on screen carries the language's decimal mark. */

const marks = new Map<string, '.' | ','>()

/** The decimal mark of `language`: "." or ",". */
export function decimalMark(language: string): '.' | ',' {
  let mark = marks.get(language)
  if (!mark) {
    const part = new Intl.NumberFormat(language)
      .formatToParts(1.1)
      .find((p) => p.type === 'decimal')
    mark = part?.value === ',' ? ',' : '.'
    marks.set(language, mark)
  }
  return mark
}

/** Its point written as the language's decimal mark; a text with no point or more than one (not a number) stays as it is. */
export function localizeNumber(text: string, language: string): string {
  const mark = decimalMark(language)
  return mark === '.' || text.split('.').length !== 2 ? text : text.replace('.', mark)
}

/** Each point between digits written as the language's decimal mark, for text of only numbers and their units: a name or an identifier such as "2.21.1" is no such text. */
export function localizeDecimals(text: string, language: string): string {
  const mark = decimalMark(language)
  return mark === '.' ? text : text.replace(/(?<=\d)\.(?=\d)/g, mark)
}

/** Each decimal mark between digits written as a point, for a file or the clipboard: the inverse of {@link localizeDecimals}. */
export function canonicalNumberText(text: string, language: string): string {
  const mark = decimalMark(language)
  return mark === '.' ? text : text.replaceAll(new RegExp(`(?<=\\d)\\${mark}(?=\\d)`, 'g'), '.')
}

const formats = new Map<string, Intl.NumberFormat>()

/** `x` with exactly `digits` decimals, no grouping and no minus sign on a value that rounds to 0. */
export function formatNumber(x: number, digits: number, language: string): string {
  const key = `${language}:${digits}`
  let format = formats.get(key)
  if (!format) {
    format = new Intl.NumberFormat(language, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      signDisplay: 'negative',
      useGrouping: false,
    })
    formats.set(key, format)
  }
  return format.format(x)
}

/** `x.toFixed(digits)` on screen: the same digits, the language's decimal mark. */
export const fixedNumber = (x: number, digits: number, language: string): string =>
  localizeNumber(x.toFixed(digits), language)

/** A number as `String(x)` writes it, on screen. */
export const plainNumber = (x: number, language: string): string =>
  localizeNumber(String(x), language)
