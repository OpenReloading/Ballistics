/** The refusals of the file readers (text, XLSX, XLS, XML, an XML load file's root) in words. */
import { type FileDiagnostic, ReaderError } from '@open-reloading/importers'
import { english, type Message, msg, type Translator } from '../i18n/translate.ts'
import { errorText } from './error-text.ts'

const fileMessages: Record<FileDiagnostic['code'], Message> = {
  utf16OddBytes: msg('UTF-16 text with an odd number of bytes'),
  notUnicodeText: msg(
    'the file is not UTF-8 or UTF-16 text; save it as UTF-8 (CSV UTF-8) and import again',
  ),
  cellBeyondColumnIV: msg('cell {cell} lies beyond column IV'),
  cellOutOfOrder: msg('cell {cell} is out of column order'),
  tooManyCells: msg('the worksheets hold more than {max} cells'),
  tooMuchCellText: msg('the worksheets hold more than {max} characters of cell text'),
  zipDirectoryMalformed: msg('not an XLSX workbook: central directory is malformed'),
  zip64: msg('not an XLSX workbook: ZIP64 archives are not read'),
  zipNoEnd: msg('not an XLSX workbook: no ZIP end of central directory record'),
  zipSplit: msg('not an XLSX workbook: split archives are not read'),
  zipDirectoryOutside: msg('not an XLSX workbook: central directory lies outside the file'),
  partTwice: msg('XLSX part {name} appears twice'),
  partsDifferInCase: msg('XLSX parts {other} and {name} differ only in case'),
  partEncrypted: msg('encrypted entries are not read'),
  partMethod: msg('compression method {method} is not read'),
  partTooLarge: msg('declares {size} bytes; the limit is {limit}'),
  partsTooLarge: msg('XLSX parts declare more than {max} bytes in total'),
  partCompressedTooLarge: msg('compressed size {compressed} is more than {size} bytes can take'),
  partNoLocalHeader: msg('local header not found'),
  partDataOutside: msg('data lies outside the file'),
  partStoredSize: msg('stored size {stored} differs from the declared {size}'),
  partCorrupt: msg('deflate data is corrupt or truncated'),
  partInflatesMore: msg('inflates to more than the declared {size} bytes'),
  partInflatesLess: msg('inflates to {length} bytes, not the declared {size}'),
  partCrc: msg('CRC-32 mismatch'),
  relationshipLeaves: msg('relationship target {target} leaves the package'),
  sharedStringOutOfRange: msg('cell {cell} refers to shared string {index} of {count}'),
  cellRefMalformed: msg('cell reference "{ref}" is malformed'),
  partMissing: msg('XLSX part {name} is missing'),
  notUtf8: msg('not valid UTF-8'),
  xmlElementsExceeded: msg('the XML parts hold more than {max} elements'),
  xmlCharactersExceeded: msg(
    'the XML parts hold more than {max} characters of text and attribute markup',
  ),
  relationshipTwice: msg('relationship {id} appears twice'),
  sheetNoRelationship: msg('sheet {sheet} has no relationship'),
  sheetPartAgain: msg('sheet {sheet} names part {target} again'),
  noDecompressionStream: msg('DecompressionStream is not available; pass an inflate function'),
  noWorkbookPart: msg('names no workbook'),
  unknownEntity: msg('unknown entity &{name};'),
  notXmlChar: msg('character reference &{name}; is not an XML character'),
  bareAmpersand: msg('bare & in text'),
  xmlBudgetSpent: msg('more {key} than allowed'),
  unclosedProcessingInstruction: msg('unclosed processing instruction'),
  unclosedComment: msg('unclosed comment'),
  unclosedCdata: msg('unclosed CDATA section'),
  duplicateAttribute: msg('duplicate attribute {name} in <{tag}>'),
  tooManyAttributes: msg('more than {max} attributes in <{tag}>'),
  malformedTag: msg('malformed tag'),
  malformedTagNamed: msg('malformed tag <{tag}>'),
  textOutsideRoot: msg('text outside the root element'),
  encodingNotRead: msg('encoding "{encoding}" is not read; only UTF-8'),
  endTagMismatch: msg('end tag </{end}> does not match <{start}>'),
  nestTooDeep: msg('elements nest deeper than {max}'),
  secondRoot: msg('more than one root element'),
  doctype: msg('DOCTYPE is not allowed'),
  markupDeclaration: msg('markup declarations are not allowed'),
  unclosedElement: msg('unclosed element <{tag}>'),
  noRoot: msg('no root element'),
  rootNotLoad: msg('The root element is not {root}.'),
  noLoad: msg('The file holds no load.'),
  cfbSectorOutsideChain: msg(
    'not an XLS workbook: sector index {index} lies outside its chain of {length}',
  ),
  cfbTooShort: msg('not an XLS workbook: the file is shorter than its 512-byte header'),
  cfbEndsBefore: msg('not an XLS workbook: the file ends before byte {byte}'),
  cfbByteOrder: msg('not an XLS workbook: byte order mark is not FFFE'),
  cfbVersion: msg('not an XLS workbook: version {version} with sector shift {shift} is not read'),
  cfbMiniLayout: msg('not an XLS workbook: mini stream layout is not the standard one'),
  cfbSectorOutside: msg('not an XLS workbook: sector {sector} lies outside the file'),
  cfbFatListed: msg('not an XLS workbook: the FAT lists {listed} of {count} sectors'),
  cfbChainLoops: msg('not an XLS workbook: sector chain loops at sector {sector}'),
  cfbNoFatEntry: msg('not an XLS workbook: sector {sector} has no FAT entry'),
  cfbNoMiniFatEntry: msg('not an XLS workbook: mini sector {sector} has no mini FAT entry'),
  cfbChainEnds: msg('not an XLS workbook: sector chain ends before the stream does'),
  cfbStreamTooLarge: msg(
    'not an XLS workbook: the {stream} stream holds {declared} bytes; the limit is {limit}',
  ),
  cfbStreamPastEnd: msg('not an XLS workbook: the {stream} stream runs past the end of the file'),
  cfbNoMiniStream: msg('not an XLS workbook: the mini stream is missing'),
  cfbMiniSectorOutside: msg(
    'not an XLS workbook: mini sector {sector} lies outside the mini stream',
  ),
  cfbNoRoot: msg('not an XLS workbook: the directory has no root entry'),
  cfbEntryRepeated: msg(
    'not an XLS workbook: directory entry {entry} is out of range or repeated',
  ),
  cfbRootTooLarge: msg('not an XLS workbook: the root storage holds more than {max} entries'),
  xlsPhoneticNegative: msg('phonetic size is negative'),
  xlsStringMalformed: msg('string record is malformed'),
  xlsRecordPastEnd: msg('XLS record at byte {at} runs past the end of the Workbook stream'),
  xlsSubstreamsOverlap: msg('XLS sheet substreams overlap'),
  xlsRecordShort: msg('XLS record at byte {at} is too short'),
  xlsNotBiff8: msg(
    'only BIFF8 .xls workbooks (Excel 97 to 2003) are read; save the workbook as .xlsx or export CSV',
  ),
  xlsNoWorkbookEof: msg('XLS workbook substream has no EOF record'),
  xlsEncrypted: msg('encrypted workbooks are not read; save the workbook without a password'),
  xlsFormulaNoString: msg('formula cell {cell} has no String record'),
  xlsNumberNotFinite: msg('cell {cell} holds a number that is not finite'),
  xlsUnknownErrorCode: msg('cell {cell} holds an unknown error code {code}'),
  xlsCellsMismatch: msg('XLS record at byte {at} does not hold the cells it names'),
  xlsUnknownValueType: msg('formula cell {cell} holds an unknown value type {type}'),
  xlsWorksheetNoEof: msg('XLS worksheet {sheet} has no EOF record'),
  xlsWorksheetNoBof: msg('XLS worksheet {sheet} does not start with a worksheet BOF record'),
  xlsWorksheetSameStart: msg('XLS worksheet {sheet} starts where an earlier worksheet starts'),
  xlsNoWorkbookStream: msg('not an XLS workbook: no Workbook stream'),
  xlsSharedStringsEnd: msg('XLS shared string table ends after {read} of {unique} strings'),
}

/** True for a diagnostic of a file reader, which `fileDiagnosticText` words. */
export const isFileDiagnostic = (d: { code: string }): d is FileDiagnostic =>
  Object.hasOwn(fileMessages, d.code)

/** Why a file reader refused a file, in the language of `t`: the XLS worksheet, the XLSX part and the XLS shared string first where named. */
export function fileDiagnosticText(d: FileDiagnostic, t: Translator['t']): string {
  const { part, worksheet, sharedString, ...rest } = d.params
  const values = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, typeof v === 'object' ? v.join(', ') : v]),
  )
  const message = t(fileMessages[d.code], values)
  const text =
    typeof sharedString === 'number'
      ? t('XLS shared string {sharedString} is malformed: {text}', { sharedString, text: message })
      : message
  const inPart = typeof part === 'string' ? t('XLSX part {part}: {text}', { part, text }) : text
  return typeof worksheet === 'number'
    ? t('XLS worksheet {worksheet}: {text}', { worksheet, text: inPart })
    : inPart
}

/** A file reader's refusal in English, or another error's message: the detail of a refused file, English as the readers wrote it. */
export const readerErrorText = (e: unknown): string =>
  e instanceof ReaderError && isFileDiagnostic(e.diagnostic)
    ? fileDiagnosticText(e.diagnostic, english.t)
    : errorText(e)
