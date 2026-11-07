/**
 * The reasons of a table import in words. The import worker gives `field` and `fields` as the
 * column labels (`labelled` in `import-entry.ts`), so this module carries no importer code.
 */
import type { TableDiagnostic } from '@open-reloading/importers'
import type { Diagnostic } from '@open-reloading/statistics'
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

/**
 * A value of a reason as shown: field labels, choices and a schema reason translated, lists joined;
 * numbers in the language's decimal mark, other text as the file has it.
 */
function shown(name: string, v: string | number | readonly string[], t: Translator['t']) {
  const word = (s: string) => t(s as Message)
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return name === 'symbols' ? v.join(', ') : v.map(word).join(', ')
  if (name === 'field') return word(v)
  return name === 'reason' ? translateMessage(v, t) : v
}

/** Why a table row is rejected or warned, in the language of `t`. */
export const tableReasonText = (
  d: TableDiagnostic | InvalidRecordDiagnostic,
  t: Translator['t'],
): string =>
  t(
    tableMessages[d.code],
    Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, shown(k, v, t)])),
  )
