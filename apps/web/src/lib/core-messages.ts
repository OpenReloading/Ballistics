import type { I18n } from '@lingui/core'
import { type Diagnostic, InputError } from '@rangefoundry/statistics'
import { errorText } from './error-text.ts'

/** A message of the table or a refusal sentence: its Lingui id and its English text, with `{name}` where a value stands. */
export type Described = { readonly id: string; readonly message: string }

type Known = (text: string, i18n: I18n) => string | undefined

let known: Known | undefined

/** Sets the table of messages the language module loaded with a language other than English. */
export function setCoreMessages(translate: Known) {
  known = translate
}

/** English pages never load the table (`core-message-table.ts`), so the text stays as it is there. */
export function translateMessage(text: string, i18n: I18n): string {
  return known?.(text, i18n) ?? text
}

type Sentence = (issue: Diagnostic<string, object>) => string | undefined

let sentence: Sentence | undefined

/** Sets the words of the typed refusals (`refusal-words.ts`), which the language module loads once a page has started. */
export function setRefusalWords(words: Sentence) {
  sentence = words
}

/** A typed refusal in its English sentence once the words have loaded, else its code. */
export const issueText = (issue: Diagnostic<string, object>): string =>
  sentence?.(issue) ?? issue.code

/** Called where the message is shown, so the sentence appears from the render after the words arrive. */
export const refusalText = (e: unknown): string =>
  e instanceof InputError && e.issue ? issueText(e.issue) : errorText(e)
