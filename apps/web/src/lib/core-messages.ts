import { type Diagnostic, InputError } from '@open-reloading/statistics'
import type { Translator } from '../i18n/translate.ts'
import { errorText } from './error-text.ts'

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

type Sentence = (issue: Diagnostic<string, object>) => string | undefined

let sentence: Sentence | undefined

/** Sets the words of the typed refusals (`refusal-words.ts`), which the language module loads once a page has started. */
export function setRefusalWords(words: Sentence) {
  sentence = words
}

/** A typed refusal in its English sentence once the words have loaded, else its code. */
export const issueText = (issue: Diagnostic<string, object>): string =>
  sentence?.(issue) ?? issue.code

/**
 * The message of a thrown value: a typed refusal (an `InputError` with an issue) in its English
 * sentence once the words have loaded, else the error's text. Called where the message is shown, it
 * shows the sentence from the render after the words arrive.
 */
export const refusalText = (e: unknown): string =>
  e instanceof InputError && e.issue ? issueText(e.issue) : errorText(e)
