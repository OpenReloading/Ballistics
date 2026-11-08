import type { UserRecord } from '@open-reloading/schema'
import type { Diagnostic } from '@open-reloading/statistics'

/** A finding of a reader: its code and the values its message names. The app words it in its language. */
export type ReaderDiagnostic<Code extends string> = Diagnostic<
  Code,
  Readonly<Record<string, string | number | readonly string[]>>
>

/** A file a reader refuses: `diagnostic` says why, and the app words it. The message is the code. */
export class ReaderError extends Error {
  readonly diagnostic: ChronoDiagnostic | PressureDiagnostic

  constructor(diagnostic: ChronoDiagnostic | PressureDiagnostic, options?: ErrorOptions) {
    super(diagnostic.code, options)
    this.name = 'ReaderError'
    this.diagnostic = diagnostic
  }
}

/**
 * What a chronograph reader warns of or refuses a file for. A `worksheet` or `row` param names
 * where; the app words it before the message.
 */
export type ChronoDiagnostic = ReaderDiagnostic<
  | 'sha256Malformed'
  | 'outsideRange'
  | 'noShots'
  | 'unitDiffersFromCaller'
  | 'unknownUnit'
  | 'missingUnit'
  | 'unknownUnitNamedByCaller'
  | 'missingUnitNamedByCaller'
  | 'velocityNotNumber'
  | 'velocityNotPositive'
  | 'skipRowsNotWhole'
  | 'skipRowsWithHeaderText'
  | 'columnBelowOne'
  | 'emptyHeaderText'
  | 'noHeaderRow'
  | 'commaMaySplit'
  | 'commaMayCutVelocity'
  | 'cellCountDiffers'
  | 'moreCellsThanHeader'
  | 'moreCellsThanHeaderComma'
  | 'unitCellDiffersFromHeader'
  | 'coldBoreUnknown'
  | 'noVelocity'
  | 'stringReturns'
  | 'notShotView'
  | 'footerDateUnknown'
  | 'footerDateMissing'
  | 'noShotViewHeader'
  | 'statisticNotNumber'
  | 'statisticDiffers'
  | 'footerStatisticsMissing'
  | 'dateFromOption'
  | 'noShotRows'
  | 'noStringOnDate'
  | 'severalDays'
  | 'notSessionJson'
  | 'versionUnsupported'
  | 'memberNotPositive'
  | 'memberNotText'
  | 'memberNotObject'
  | 'memberNotDeviceKind'
  | 'velocityRequired'
  | 'memberNotBoolean'
  | 'excludedNotText'
  | 'noStrings'
  | 'noStringShots'
  | 'memberNotDate'
  | 'notTemplate'
  | 'needsColumnMapping'
  | 'readsText'
  | 'readsWorkbooks'
>

/** Throws the refusal `code` with `params`. */
export function refuse(
  code: ChronoDiagnostic['code'],
  params: ChronoDiagnostic['params'] = {},
): never {
  throw new ReaderError({ code, params })
}

/**
 * What the pressure-history reader warns of or refuses a trace for. `column` is `time` or
 * `pressure`, `line` the line of the file.
 */
export type PressureDiagnostic = ReaderDiagnostic<
  | 'sensorMissing'
  | 'columnsNotDistinct'
  | 'cutoffNotPositive'
  | 'columnUnitDiffersFromCaller'
  | 'columnUnitMissing'
  | 'columnUnitNamedByCaller'
  | 'readingNotNumber'
  | 'readingNotFinite'
  | 'timesNotIncreasing'
  | 'tooFewSamples'
>

/** Throws the pressure-history refusal `code` with `params`. */
export function refuseTrace(
  code: PressureDiagnostic['code'],
  params: PressureDiagnostic['params'] = {},
): never {
  throw new ReaderError({ code, params })
}

/**
 * A record as a reader reads it, without the id and save time the app gives it when it keeps it.
 * Its id is `idOfKey(key)`; the references of the candidates of one read to each other use it.
 */
export type Candidate = UserRecord extends infer R
  ? R extends UserRecord
    ? Omit<R, 'id' | 'saved'> & { key: string }
    : never
  : never
