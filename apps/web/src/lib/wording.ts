import type { I18n, MessageDescriptor } from '@lingui/core'

/** A Lingui message, or a verbatim text that is never translated. */
export type LinguiWording = MessageDescriptor | { verbatim: string }

/** A text shown as it is: a record's name or a printed value. */
export const verbatim = (text: string) => ({ verbatim: text })

/** The text of `w` in the language of `i18n` (`useLingui()`). */
export const sayLingui = (i18n: I18n, w: LinguiWording): string =>
  'id' in w ? i18n._(w) : w.verbatim
