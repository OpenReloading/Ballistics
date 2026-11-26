import type { Message, Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'

/** A field label in the language of `t`: the table words the labels of the importers and the schema, the catalogue the others. */
export function labelText(label: string, t: Translator['t']): string {
  const tabled = translateMessage(label, t)
  return tabled === label ? t(label as Message) : tabled
}
