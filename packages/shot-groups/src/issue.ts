import type { Diagnostic } from '@open-reloading/statistics'

// The typed refusals of this package, raised as the `InputError` of `@open-reloading/statistics`
// with the issue: a code and the values its message needs, no text.

/** Why a photo calibration or a matrix operation refuses its input. */
export type GeometryIssue =
  | Diagnostic<'matrix-size', { entries: number }>
  | Diagnostic<'singular-matrix'>
  /** The points give no unique solution: a linear system without a pivot, a circle fit without a radius. */
  | Diagnostic<'degenerate-points'>
  | Diagnostic<'four-point-pairs'>
  /** Three points of a homography or a circle lie on one line. */
  | Diagnostic<'collinear-points'>
  /** A scale reference without a length above 0 on the photo and on the target. */
  | Diagnostic<'reference-length', { reference: 'line' | 'ringCentre' | 'ringEdge' | 'rectangle' }>
  | Diagnostic<'reference-needed'>
  | Diagnostic<'one-rectangle'>

/** Why ring marks do not place a face on a sheet. */
export type RingFitIssue =
  | Diagnostic<'two-rings'>
  | Diagnostic<'four-points'>
  | Diagnostic<'degenerate-points'>
  | Diagnostic<'one-bull'>
  | Diagnostic<'circular-rings'>
  /** A mark names a ring value the face does not have. */
  | Diagnostic<'no-ring', { value: number }>

/** Why a competition score refuses a stage or a series. */
export type ScoringIssue =
  /** A hit, miss or penalty count that is not a whole number of 0 or more. */
  | Diagnostic<'count'>
  | Diagnostic<'stage-time'>
  | Diagnostic<'stage-points'>
  | Diagnostic<'ring-value'>
  /** A series with neither its shots nor its total. */
  | Diagnostic<'series-total'>

/** Why the hit probability refuses a dispersion, a zone or a probability. */
export type HitIssue =
  | Diagnostic<'distances'>
  | Diagnostic<'group-dispersion'>
  | Diagnostic<'speed-spread'>
  /** The height spread from the muzzle speed exceeds the vertical spread of the group. */
  | Diagnostic<'speed-height'>
  | Diagnostic<'wind'>
  | Diagnostic<'range-uncertainty'>
  | Diagnostic<'semi-axes'>
  | Diagnostic<'standard-deviations'>
  | Diagnostic<'offset'>
  | Diagnostic<'hit-probability'>
  | Diagnostic<'wanted-probability'>
  | Diagnostic<'zones'>

/** Why a function of this package refuses its input. */
export type Issue = GeometryIssue | RingFitIssue | ScoringIssue | HitIssue
