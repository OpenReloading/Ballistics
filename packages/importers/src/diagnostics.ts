import type { UserRecord } from '@rangefoundry/schema'
import type { Diagnostic } from '@rangefoundry/statistics'

/** A finding of a reader: its code and the values its message names. The app words it in its language. */
export type ReaderDiagnostic<Code extends string> = Diagnostic<
  Code,
  Readonly<Record<string, string | number | readonly string[]>>
>

/** A file a reader refuses: `diagnostic` says why, and the app words it. The message is the code. */
export class ReaderError extends Error {
  readonly diagnostic: ChronoDiagnostic | PressureDiagnostic | FileDiagnostic

  constructor(
    diagnostic: ChronoDiagnostic | PressureDiagnostic | FileDiagnostic,
    options?: ErrorOptions,
  ) {
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
 * Why a file reader refuses the bytes or the text of a file: text decoding, the ZIP and XML of an
 * XLSX workbook, the compound file and records of an XLS workbook, their cells, and the root of an
 * XML load file. A `part` param names the XLSX part, a `worksheet` param the XLS worksheet and a
 * `sharedString` param the XLS shared string; the app words them before the message. A refused
 * cell is named by its reference (`cell`), or by its column (`column`) when it has none.
 */
export type FileDiagnostic = ReaderDiagnostic<
  | 'utf16OddBytes'
  | 'notUnicodeText'
  | 'cellBeyondColumnIV'
  | 'cellOutOfOrder'
  | 'tooManyCells'
  | 'tooMuchCellText'
  | 'zipDirectoryMalformed'
  | 'zip64'
  | 'zipNoEnd'
  | 'zipSplit'
  | 'zipDirectoryOutside'
  | 'partTwice'
  | 'partsDifferInCase'
  | 'partEncrypted'
  | 'partMethod'
  | 'partTooLarge'
  | 'partsTooLarge'
  | 'partCompressedTooLarge'
  | 'partNoLocalHeader'
  | 'partDataOutside'
  | 'partStoredSize'
  | 'partCorrupt'
  | 'partInflatesMore'
  | 'partInflatesLess'
  | 'partCrc'
  | 'relationshipLeaves'
  | 'sharedStringOutOfRange'
  | 'cellRefMalformed'
  | 'partMissing'
  | 'notUtf8'
  | 'xmlElementsExceeded'
  | 'xmlCharactersExceeded'
  | 'relationshipTwice'
  | 'sheetNoRelationship'
  | 'sheetPartAgain'
  | 'noDecompressionStream'
  | 'noWorkbookPart'
  | 'unknownEntity'
  | 'notXmlChar'
  | 'bareAmpersand'
  | 'xmlBudgetSpent'
  | 'unclosedProcessingInstruction'
  | 'unclosedComment'
  | 'unclosedCdata'
  | 'duplicateAttribute'
  | 'tooManyAttributes'
  | 'malformedTag'
  | 'malformedTagNamed'
  | 'textOutsideRoot'
  | 'encodingNotRead'
  | 'endTagMismatch'
  | 'nestTooDeep'
  | 'secondRoot'
  | 'doctype'
  | 'markupDeclaration'
  | 'unclosedElement'
  | 'noRoot'
  | 'rootNotLoad'
  | 'noLoad'
  | 'cfbSectorOutsideChain'
  | 'cfbTooShort'
  | 'cfbEndsBefore'
  | 'cfbByteOrder'
  | 'cfbVersion'
  | 'cfbMiniLayout'
  | 'cfbSectorOutside'
  | 'cfbFatListed'
  | 'cfbChainLoops'
  | 'cfbNoFatEntry'
  | 'cfbNoMiniFatEntry'
  | 'cfbChainEnds'
  | 'cfbStreamTooLarge'
  | 'cfbStreamPastEnd'
  | 'cfbNoMiniStream'
  | 'cfbMiniSectorOutside'
  | 'cfbNoRoot'
  | 'cfbEntryRepeated'
  | 'cfbRootTooLarge'
  | 'xlsPhoneticNegative'
  | 'xlsStringMalformed'
  | 'xlsRecordPastEnd'
  | 'xlsSubstreamsOverlap'
  | 'xlsRecordShort'
  | 'xlsNotBiff8'
  | 'xlsNoWorkbookEof'
  | 'xlsEncrypted'
  | 'xlsFormulaNoString'
  | 'xlsNumberNotFinite'
  | 'xlsUnknownErrorCode'
  | 'xlsCellsMismatch'
  | 'xlsUnknownValueType'
  | 'xlsWorksheetNoEof'
  | 'xlsWorksheetNoBof'
  | 'xlsWorksheetSameStart'
  | 'xlsNoWorkbookStream'
  | 'xlsSharedStringsEnd'
>

/** Throws the file refusal `code` with `params`. */
export function refuseFile(
  code: FileDiagnostic['code'],
  params: FileDiagnostic['params'] = {},
): never {
  throw new ReaderError({ code, params })
}

/** `e` again with `at` added to the params of its diagnostic, when it is a reader's refusal. */
export function locatedError(e: unknown, at: Record<string, string | number>): unknown {
  if (!(e instanceof ReaderError)) return e
  const d = e.diagnostic
  return new ReaderError({ ...d, params: { ...d.params, ...at } }, { cause: e })
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
