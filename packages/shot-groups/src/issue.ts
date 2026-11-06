/** A typed diagnostic: a code and the values its message needs, empty when it needs none. */
export type Diagnostic<C extends string, P extends object = Record<string, never>> = {
  code: C
  params: P
}

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

/** Why a function of this package refuses its input. */
export type Issue = GeometryIssue | RingFitIssue | ScoringIssue

/**
 * The refusal of a function of this package. It carries no text: the caller words `issue` in its
 * language. A deliberate refusal is a RangeError, as the `InputError` of `@open-reloading/statistics`.
 * shortcut: a class of this package; throw the shared `InputError` with the issue once statistics is on main (#1013).
 */
export class ShotGroupsError extends RangeError {
  readonly issue: Issue

  constructor(issue: Issue) {
    super(issue.code)
    this.name = 'ShotGroupsError'
    this.issue = issue
  }
}
