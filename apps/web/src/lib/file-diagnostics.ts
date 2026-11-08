/** The refusals of the file readers (text, XLSX, XML, an XML load file's root) in words. */
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
}

/** True for a diagnostic of a file reader, which `fileDiagnosticText` words. */
export const isFileDiagnostic = (d: { code: string }): d is FileDiagnostic =>
  Object.hasOwn(fileMessages, d.code)

/** Why a file reader refused a file, in the language of `t`: the XLS worksheet and the XLSX part first where named. */
export function fileDiagnosticText(d: FileDiagnostic, t: Translator['t']): string {
  const { part, worksheet, column, ...rest } = d.params
  const values = Object.fromEntries(
    Object.entries(rest).map(([k, v]) => [k, typeof v === 'object' ? v.join(', ') : v]),
  )
  // a cell without a reference is named by its column
  if (typeof column === 'number') values['cell'] = t('at column {column}', { column })
  const text = t(fileMessages[d.code], values)
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
