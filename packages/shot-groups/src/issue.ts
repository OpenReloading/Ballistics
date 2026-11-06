/** Why a photo calibration or a matrix operation refuses its input. */
export type GeometryIssue =
  | { code: 'matrix-size'; entries: number }
  | { code: 'singular-matrix' }
  /** The points give no unique solution: a linear system without a pivot, a circle fit without a radius. */
  | { code: 'degenerate-points' }
  | { code: 'four-point-pairs' }
  /** Three points of a homography or a circle lie on one line. */
  | { code: 'collinear-points' }
  /** A scale reference without a length above 0 on the photo and on the target. */
  | { code: 'reference-length'; reference: 'line' | 'ringCentre' | 'ringEdge' | 'rectangle' }
  | { code: 'reference-needed' }
  | { code: 'one-rectangle' }

/** Why ring marks do not place a face on a sheet. */
export type RingFitIssue =
  | { code: 'two-rings' }
  | { code: 'four-points' }
  | { code: 'degenerate-points' }
  | { code: 'one-bull' }
  | { code: 'circular-rings' }
  /** A mark names a ring value the face does not have. */
  | { code: 'no-ring'; value: number }

/** Why a competition score refuses a stage or a series. */
export type ScoringIssue =
  /** A hit, miss or penalty count that is not a whole number of 0 or more. */
  | { code: 'count' }
  | { code: 'stage-time' }
  | { code: 'stage-points' }
  | { code: 'ring-value' }
  /** A series with neither its shots nor its total. */
  | { code: 'series-total' }

/** Why a function of this package refuses its input: a code and the data a message needs. */
export type Issue = GeometryIssue | RingFitIssue | ScoringIssue

/** The refusal of a function of this package. It carries no text: the caller words `issue` in its language. */
export class ShotGroupsError extends Error {
  readonly issue: Issue

  constructor(issue: Issue) {
    super(issue.code)
    this.name = 'ShotGroupsError'
    this.issue = issue
  }
}
