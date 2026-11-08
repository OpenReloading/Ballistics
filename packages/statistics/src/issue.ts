import { type Diagnostic, need as needAny } from './errors.ts'

/** Why a function of this package refuses its input. */
export type StatisticsIssue =
  | Diagnostic<'probabilityOutsideUnit'>
  | Diagnostic<'levelOutsideUnit'>
  | Diagnostic<'confidenceLevelOutsideUnit'>
  | Diagnostic<'degreesOfFreedomNotPositive'>
  | Diagnostic<'degreesOfFreedomNotPositiveWhole'>
  | Diagnostic<'maxIterationsNotPositiveInteger'>
  | Diagnostic<'maxConditionOutOfRange'>
  | Diagnostic<'velocitiesNotFinite'>
  | Diagnostic<'relativeHalfWidthBelowMinimum'>
  | Diagnostic<'relativeHalfWidthOutOfReach'>

/** `need` with an issue of this package. */
export const need: (ok: boolean, issue: StatisticsIssue) => void = needAny
