import type { I18n, MessageDescriptor } from '@lingui/core'
import type { Message, Translator } from '../i18n/translate.ts'

/** The values of the `{name}` placeholders of a message: text as shown, or a number the language writes. */
type Values = Readonly<Record<string, string | number>>

/** A text of the catalogue keyed by its English, or a verbatim text that is never translated. */
export type OwnWording = Message | { verbatim: string } | { message: Message; values: Values }

/** Every form survives the server-to-client step as data; a descriptor is a Lingui message id with its values. */
export type Wording = OwnWording | MessageDescriptor

/** A Lingui message, or a verbatim text that is never translated. */
export type LinguiWording = MessageDescriptor | { verbatim: string }

/** A text shown as it is: a record's name or a printed value. */
export const verbatim = (text: string) => ({ verbatim: text })

/** A message with its placeholders filled where it is shown. */
export const worded = (message: Message, values: Values): OwnWording => ({ message, values })

/** The text of `w` in the language of `t` (`useTranslation()`). */
function sayOwn(t: Translator['t'], w: OwnWording): string {
  if (typeof w === 'string') return t(w)
  return 'verbatim' in w ? w.verbatim : t(w.message, w.values)
}

/** The text of `w` in the language of `i18n` (`useLingui()`). */
export const sayLingui = (i18n: I18n, w: LinguiWording): string =>
  'id' in w ? i18n._(w) : w.verbatim

/** The text of `w` in the language of `i18n` (`useLingui()`) and `t`, which reads a text not yet on an id. */
export const say = (i18n: I18n, t: Translator['t'], w: Wording): string =>
  typeof w === 'object' && 'id' in w ? i18n._(w) : sayOwn(t, w)
