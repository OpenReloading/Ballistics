import type { Message, Translator } from '../i18n/translate.ts'

/** The values of the `{name}` placeholders of a message: text as shown, or a number the language writes. */
type Values = Readonly<Record<string, string | number>>

/**
 * A text that a server component or a data builder hands to the client for translation where it is
 * shown: a message of the catalogue (marked with `msg`), a text as it is published (a record's name,
 * a printed value: never translated) or a message with the values of its placeholders. All three
 * survive the step from server to client as data.
 */
export type Wording = Message | { verbatim: string } | { message: Message; values: Values }

/** A text shown as it is: a record's name or a printed value. */
export const verbatim = (text: string): Wording => ({ verbatim: text })

/** A message with its placeholders filled where it is shown. */
export const worded = (message: Message, values: Values): Wording => ({ message, values })

/** The text of `w` in the language of `t` (`useTranslation()`). */
export function say(t: Translator['t'], w: Wording): string {
  if (typeof w === 'string') return t(w)
  return 'verbatim' in w ? w.verbatim : t(w.message, w.values)
}
