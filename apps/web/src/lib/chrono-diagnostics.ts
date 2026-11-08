/** The warnings and refusals of the chronograph readers in words, loaded where they are shown. */
import { type ChronoDiagnostic, type CommaRemedy, ReaderError } from '@open-reloading/importers'
import { fixedNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { chronoOwnMessages, formats } from './chrono.ts'
import { translateMessage } from './core-messages.ts'
import { errorText } from './error-text.ts'

const chronoMessages: Record<ChronoDiagnostic['code'], Message> = {
  sha256Malformed: msg('sha256 must be 64 hex digits'),
  outsideRange: msg(
    'string {string}: shots {shots} outside {min} to {max} m/s; check the unit, the column and statistics rows',
  ),
  noShots: msg('no shots found'),
  unitDiffersFromCaller: msg(
    'velocity unit "{text}" ({unit}) in the file differs from {caller} named by the caller',
  ),
  unknownUnit: msg('velocity unit "{text}" is unknown; name the unit to import this file'),
  missingUnit: msg('velocity unit missing is unknown; name the unit to import this file'),
  unknownUnitNamedByCaller: msg(
    'velocity unit "{text}" in the file; using {unit} as named by the caller',
  ),
  missingUnitNamedByCaller: msg(
    'velocity unit missing in the file; using {unit} as named by the caller',
  ),
  velocityNotNumber: msg('velocity "{cell}" is not a number'),
  velocityNotPositive: msg('velocity "{cell}" is not positive'),
  skipRowsNotWhole: msg('skipRows must be a whole number >= 0'),
  skipRowsWithHeaderText: msg(
    'skipRows applies only when every column is a number; the header row is found by name',
  ),
  columnBelowOne: msg('column {column} = {number}: column numbers count from 1'),
  emptyHeaderText: msg('column {column}: empty header text'),
  noHeaderRow: msg('no header row holds {names}'),
  commaMaySplit: msg(
    '{rows}: "{cells}" may be a velocity with a decimal comma or a thousands separator split by the delimiter; check the values or {remedy}',
  ),
  commaMayCutVelocity: msg(
    '"{cells}" may be one velocity with a decimal comma or a thousands separator; {remedy}',
  ),
  cellCountDiffers: msg('{cells} cells, row {firstRow} has {firstCells}'),
  moreCellsThanHeader: msg('{cells} cells, the header has {header}'),
  moreCellsThanHeaderComma: msg(
    '{cells} cells, the header has {header}; an unquoted comma inside a cell (a decimal comma or a thousands separator) splits it: {remedy}',
  ),
  unitCellDiffersFromHeader: msg(
    'velocityUnit "{cell}" differs from "{token}" in the velocity header "{header}"',
  ),
  coldBoreUnknown: msg('coldBore "{text}" is not one of {choices} or empty'),
  noVelocity: msg('no velocity; skipped'),
  stringReturns: msg('string "{label}" returns after another string; read as a new string'),
  notShotView: msg('not a ShotView CSV: no "#" header row with a velocity unit'),
  footerDateUnknown: msg('footer date "{text}" is not recognised; enter the date'),
  footerDateMissing: msg('footer date row not found; enter the date'),
  noShotViewHeader: msg('no ShotView header row; skipped'),
  statisticNotNumber: msg('footer {label} "{value}" is not a number; not checked'),
  statisticDiffers: msg('footer {label} "{value}" differs from {computed} computed from the shots'),
  footerStatisticsMissing: msg('footer statistics not found; not checked'),
  dateFromOption: msg('no date read; {date} taken from the date option'),
  noShotRows: msg('no shot rows; skipped'),
  noStringOnDate: msg('no string on {date}; dates in the file: {dates}'),
  severalDays: msg(
    'strings from several days ({dates}); enter the date, or import one day with the date option',
  ),
  notSessionJson: msg('not an OpenReloading session JSON file: "format" must be "{format}"'),
  versionUnsupported: msg('version {version} is not supported; expected 1'),
  memberNotPositive: msg('{path}: must be a positive number'),
  memberNotText: msg('{path}: must be text'),
  memberNotObject: msg('{path}: must be an object'),
  memberNotDeviceKind: msg('{path}: must be one of {kinds}'),
  velocityRequired: msg('{path}: is required, in m/s'),
  memberNotBoolean: msg('{path}: must be true or false'),
  excludedNotText: msg('{path}: must be the reason as text'),
  noStrings: msg('{path}: must list at least one string'),
  noStringShots: msg('{path}: must list at least one shot'),
  memberNotDate: msg('{path}: must be a date as YYYY-MM-DD'),
  notTemplate: msg(
    'not an OpenReloading CSV template: the first row must name columns from {columns}, velocity among them',
  ),
  needsColumnMapping: msg('the delimited format needs a column mapping'),
  readsText: msg('{format} reads text files; this file is a workbook'),
  readsWorkbooks: msg('{format} reads workbooks; this file is text'),
}

const remedies: Record<CommaRemedy, Message> = {
  quoteOrSemicolon: msg("quote the cell or use ';' as the delimiter"),
  nameDelimiter: msg('name the delimiter'),
}

/** The rows a comma may split: the first five named, the rest counted. */
function rowsText(rows: readonly string[], t: Translator['t']) {
  if (rows.length === 1) return t('row {row}', { row: rows[0] ?? '' })
  const listed = rows.slice(0, 5).join(', ')
  return rows.length > 5
    ? t('rows {rows} and {more} more', { rows: listed, more: rows.length - 5 })
    : t('rows {rows}', { rows: listed })
}

/** A value as the message shows it: lists joined, the comma remedy and the comma rows in words. */
function shown(name: string, v: string | number | readonly string[], t: Translator['t']) {
  if (name === 'remedy' && typeof v === 'string' && Object.hasOwn(remedies, v))
    return t(remedies[v as CommaRemedy])
  if (name === 'computed' && typeof v === 'number') return fixedNumber(v, 1)
  if (typeof v !== 'object') return v
  if (name === 'rows') return rowsText(v, t)
  return (name === 'names' ? v.map((n) => `"${n}"`) : v).join(', ')
}

/** What a chronograph reader warned of or refused, in the language of `t`: the worksheet and row first where named. */
export function chronoDiagnosticText(d: ChronoDiagnostic, t: Translator['t']): string {
  const { worksheet, row, ...rest } = d.params
  const values = Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, shown(k, v, t)]))
  const text = t(chronoMessages[d.code], values)
  const atRow = typeof row === 'number' ? t('row {row}: {text}', { row, text }) : text
  return typeof worksheet === 'number'
    ? t('worksheet {worksheet}: {text}', { worksheet, text: atRow })
    : atRow
}

/** Why a chronograph file was not read, in the language of `t`: a reader's refusal, `chrono.ts`'s own, or another error's message. */
export function chronoErrorText(error: unknown, t: Translator['t']): string {
  if (error instanceof ReaderError) return chronoDiagnosticText(error.diagnostic, t)
  const text = errorText(error)
  const own = chronoOwnMessages.find((m) => m === text)
  return own ? t(own, { formats }) : translateMessage(text, t)
}
