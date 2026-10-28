import type { Translator } from '../i18n/translate.ts'

type Known = (text: string, t: Translator['t']) => string | undefined

let known: Known | undefined

/** Sets the table of messages the language module loaded with a language other than English. */
export function setCoreMessages(translate: Known) {
  known = translate
}

/**
 * A message that came from the packages, the API or the app's own request code, in the language of
 * `t`: the text of the message that `text` is an instance of, else `text` as it is. English pages
 * never load the table (`core-message-table.ts`), so the text stays as it is.
 */
export function translateMessage(text: string, t: Translator['t']): string {
  return known?.(text, t) ?? text
}
