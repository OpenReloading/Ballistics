import { type Diagnostic, InputError as StatisticsInputError } from '@open-reloading/statistics'

/** Why a use case refuses a request: a record without a value the run needs, or a result it cannot answer. */
export type UseCaseIssue =
  | Diagnostic<'resultNotFinite', { path: string }>
  | Diagnostic<'powderBulkDensityOutOfRange', { powder: string; density: number; max: number }>
  | Diagnostic<'powderWithoutBulkDensity', { powder: string }>
  | Diagnostic<'bulletWithoutDiameter', { bullet: string }>
  | Diagnostic<'bulletWithoutLength', { bullet: string }>
  | Diagnostic<
      'bulletValueOutOfBounds',
      { bullet: string; key: string; value: number; unit: string; low: number; high: number }
    >
  | Diagnostic<'bulletWithoutCoefficient', { bullet: string; model: string }>
  | Diagnostic<'bulletCoefficientsWithoutBands', { bullet: string; count: number; model: string }>
  | Diagnostic<'ladderChargeNotAboveZero', { charge: number }>

/** The `InputError` of `@open-reloading/statistics`, raised with an issue of this package. */
export const InputError: new (issue: UseCaseIssue) => StatisticsInputError = StatisticsInputError

/** A record id of a request that the catalogue does not hold. */
export type RecordNotFoundIssue = Diagnostic<'recordNotFound', { kind: string; id: string }>

/** An unknown record id of a request, answered 404 with its issue; its code is the message. */
export class RecordNotFound extends Error {
  readonly issue: RecordNotFoundIssue

  constructor(kind: string, id: string) {
    super('recordNotFound')
    this.name = 'RecordNotFound'
    this.issue = { code: 'recordNotFound', params: { kind, id } }
  }
}
