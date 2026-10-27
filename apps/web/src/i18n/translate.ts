/** A catalogue entry: the text, or the texts of a plural by CLDR plural category (`one`, `other`, ...). */
type Entry = string | Readonly<Record<string, string>>

/** The translations of one language, keyed by the English source text. A plural's key is `one|other`. */
export type Catalogue = Readonly<Record<string, Entry>>

/** The values of the `{name}` placeholders of a text. */
type Values = Readonly<Record<string, string | number>>

declare const marked: unique symbol
/** An English text marked for extraction by {@link msg}: `t` takes it where the text is not a literal at the call. */
export type Message = string & { readonly [marked]: true }

/**
 * Marks an English text as a message of the catalogue (data such as page labels; `t` translates it
 * where it is shown). It returns the text itself.
 */
// the brand has no runtime form: the text stays a plain string
export const msg = (text: string) => text as Message

/** A literal text; a `string` that is not one is a type error, so no text escapes extraction. */
type Literal<S extends string> = string extends S ? never : S

interface Translate {
  (text: Message, values?: Values): string
  <S extends string>(text: S & Literal<S>, values?: Values): string
}

type TranslatePlural = <A extends string, B extends string>(
  count: number,
  one: A & Literal<A>,
  other: B & Literal<B>,
  values?: Values,
) => string

/** The functions of one language; `language` is the one shown (English while its catalogue is not loaded). */
export interface Translator {
  language: string
  t: Translate
  tn: TranslatePlural
}

/** Decimal separator of `language`, no digit grouping (the app shows numbers ungrouped). */
const numberText = (language: string, n: number) =>
  new Intl.NumberFormat(language, { useGrouping: false, maximumFractionDigits: 20 }).format(n)

const fill = (text: string, values: Values | undefined, language: string) =>
  values
    ? text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
        const v = values[name]
        return v === undefined ? placeholder : typeof v === 'number' ? numberText(language, v) : v
      })
    : text

/**
 * The translation functions for `catalogue` of `language`. A text the catalogue lacks is shown as
 * written in the source (English), so nothing is ever blank or a key; without a catalogue every
 * text is English.
 */
export function translator(catalogue?: Catalogue, language = 'en'): Translator {
  const shown = catalogue ? language : 'en'
  const rules = new Intl.PluralRules(shown)
  return {
    language: shown,
    t: (text: string, values?: Values) => {
      const entry = catalogue?.[text]
      return fill(typeof entry === 'string' ? entry : text, values, shown)
    },
    tn: (count: number, one: string, other: string, values?: Values) => {
      const entry = catalogue?.[`${one}|${other}`]
      const text =
        typeof entry === 'object'
          ? (entry[rules.select(count)] ?? entry.other ?? other)
          : new Intl.PluralRules('en').select(count) === 'one'
            ? one
            : other
      return fill(text, { ...values, count }, shown)
    },
  }
}

/**
 * The English functions: what a file, the clipboard or a link carries whatever language is shown,
 * and the text of a test.
 */
export const english: Translator = translator()
