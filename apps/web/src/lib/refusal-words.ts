/**
 * The words of the typed refusals that statistics and the group statistics of shot-groups raise
 * (`InputError` of `@open-reloading/statistics` with an issue): the English sentence of each code.
 * The language module loads them once a page has started, outside every page's own JavaScript, for
 * `refusalText` of `core-messages.ts`; `core-message-table.ts` reads them as templates, so
 * `translateMessage` shows a sentence in the language shown. Hit probability and ring scoring word
 * their own issues where they are shown.
 */
import type { GroupStatisticsIssue } from '@open-reloading/shot-groups'
import { type Diagnostic, InputError, type StatisticsIssue } from '@open-reloading/statistics'
import { english, type Message, msg } from '../i18n/translate.ts'
import { errorText } from './error-text.ts'

const statisticsWords = {
  probabilityOutsideUnit: msg('probability must lie in (0, 1)'),
  levelOutsideUnit: msg('level must lie in (0, 1)'),
  confidenceLevelOutsideUnit: msg('confidence level must lie in (0, 1)'),
  degreesOfFreedomNotPositive: msg('degrees of freedom must be positive'),
  degreesOfFreedomNotPositiveWhole: msg('degrees of freedom must be a positive whole number'),
  maxIterationsNotPositiveInteger: msg('maxIterations must be a positive integer'),
  maxConditionOutOfRange: msg('maxCondition must be finite and at least 1'),
  velocitiesNotFinite: msg('velocities must be finite'),
  relativeHalfWidthBelowMinimum: msg('relative half-width must be at least 0.01'),
  relativeHalfWidthOutOfReach: msg('relative half-width needs more shots than the search covers'),
} satisfies Record<StatisticsIssue['code'], Message>

const groupStatisticsWords = {
  'confidence-level': msg('confidence level must lie in (0, 1)'),
  distance: msg('distance must be positive'),
  'shot-coordinates': msg('shot coordinates must be finite'),
  'shot-velocity': msg('shot velocity must be finite'),
  aim: msg('aim must be finite'),
  coverage: msg('coverage must lie in (0, 1)'),
} satisfies Record<GroupStatisticsIssue['code'], Message>

/** The words of every code. */
export const refusalWords: Readonly<Record<string, Message>> = {
  ...statisticsWords,
  ...groupStatisticsWords,
}

/** The English sentence of a typed refusal; undefined for a code without words. */
export function refusalSentence({ code }: Diagnostic<string, object>): string | undefined {
  const words = Object.hasOwn(refusalWords, code) ? refusalWords[code] : undefined
  return words && english.t(words)
}

/** The message of a thrown value, with a typed refusal as its English sentence: for a worker, which has the words at once. */
export const refusalErrorText = (e: unknown): string =>
  (e instanceof InputError && e.issue && refusalSentence(e.issue)) || errorText(e)
