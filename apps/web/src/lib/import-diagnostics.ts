/** The worker gives fields as column labels (`labelled` in `import-entry.ts`), so this module carries no importer code. */
import type {
  KindDiagnostic,
  TableDiagnostic,
  TableKind,
  TableReadDiagnostic,
} from '@open-reloading/importers'
import type { Diagnostic } from '@rangefoundry/statistics'
import { fixedNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'

/** A table row the user record schema refuses, with the schema's reason. */
export type InvalidRecordDiagnostic = Diagnostic<'invalidRecord', { reason: string }>

const tableMessages: Record<TableDiagnostic['code'] | InvalidRecordDiagnostic['code'], Message> = {
  emptyCell: msg('{field} is empty. Fill the cell or delete the row.'),
  noUnit: msg('{field} has no unit. Choose a unit for the column.'),
  unitOther: msg(
    '{field}: the header names a unit other than {symbols}. Choose the unit of the column.',
  ),
  notNumber: msg(
    '{field} "{cell}" is not a number with "{mark}" as decimal mark. Fix the cell or change the decimal mark of the column.',
  ),
  notAboveZero: msg('{field} {cell} is not above 0. Fix the cell or leave it empty.'),
  outsideUsual: msg(
    '{field} {cell} {unit} is outside the usual {low} to {high} {stored}. Check the unit of the column.',
  ),
  notChoice: msg(
    '{field} "{cell}" is not one of {choices}. The value is left out; change the cell to keep it.',
  ),
  noColumn: msg(
    'No column is mapped to {fields}. Map a column to it or read the file as another kind.',
  ),
  noColumns: msg(
    'No column is mapped to {fields}. Map a column to each or read the file as another kind.',
  ),
  sameBulletId: msg(
    'Rows {first} and {row} give the same name, maker, diameter and mass, so one id: only row {first} is imported. Change the name, maker, diameter or mass of row {row} to import it as a record of its own.',
  ),
  sameId: msg(
    'Rows {first} and {row} give the same name and maker, so one id: only row {first} is imported. Change the name or maker of row {row} to import it as a record of its own.',
  ),
  invalidRecord: msg('{reason}. Fix the row or delete it.'),
}

/** Numbers in the language's decimal mark, other text as the file has it. */
function shown(name: string, v: string | number | readonly string[], t: Translator['t']) {
  const word = (s: string) => t(s as Message)
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return name === 'symbols' ? v.join(', ') : v.map(word).join(', ')
  if (name === 'field') return word(v)
  return name === 'reason' ? translateMessage(v, t) : v
}

const shownParams = (params: TableDiagnostic['params'], t: Translator['t']) =>
  Object.fromEntries(Object.entries(params).map(([k, v]) => [k, shown(k, v, t)]))

/** Why a table row is rejected or warned, in the language of `t`. */
export const tableReasonText = (
  d: TableDiagnostic | InvalidRecordDiagnostic,
  t: Translator['t'],
): string => t(tableMessages[d.code], shownParams(d.params, t))

const tableReadMessages: Record<TableReadDiagnostic['code'], Message> = {
  noTwoColumns: msg('The rows have no table of two columns or more.'),
  tooManyColumns: msg(
    'The table has more than {max} columns. Remove the extra columns or choose another file.',
  ),
  tooManyCells: msg('The table has more than {max} cells. Split it into smaller files.'),
  headerOnly: msg('The table has a header but no rows. Add rows or choose another file.'),
  jsonMalformed: msg(
    'The text looks like JSON but does not parse. Fix the file or export it again.',
  ),
  jsonNotTable: msg(
    'The JSON is neither a RangeFoundry data file nor a list of objects with the same keys. Export a table instead.',
  ),
  noDelimiter: msg(
    'The text has no table: no row repeats a comma, semicolon or tab as separator. Export the table as CSV.',
  ),
}

/** Why a file holds no table, in the language of `t`; a refusal the app wrote itself is English text. */
export const tableReadText = (r: TableReadDiagnostic | string, t: Translator['t']): string =>
  typeof r === 'string'
    ? translateMessage(r, t)
    : t(tableReadMessages[r.code], shownParams(r.params, t))

export const kindLabels: Record<TableKind, Message> = {
  bullet: msg('bullets'),
  powder: msg('powders'),
  cartridge: msg('cartridges'),
}

/** Why no kind is suggested for a table, with the scores and the floor, in the language of `t`. */
export function kindRefusalText({ params }: KindDiagnostic, t: Translator['t']): string {
  const scores = params.scores
    .map((s) => `${t(kindLabels[s.kind])} ${fixedNumber(s.score, 2)}`)
    .join(', ')
  return t(
    'No column matches a bullet, powder or cartridge field ({scores}; the floor is {floor}). Pick the kind by hand, or export a table with headers such as Name, Diameter, Weight.',
    { scores, floor: fixedNumber(params.floor, 2) },
  )
}
