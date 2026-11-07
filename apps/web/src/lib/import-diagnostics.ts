/** The records the app makes of the importers' candidates, and their diagnostics in words. */
import {
  type Candidate,
  type Diagnostic,
  fieldSpecs,
  idOfKey,
  type LoadDiagnostic,
  type TableDiagnostic,
  tableKinds,
} from '@open-reloading/importers'
import type { UserRecord } from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { translateMessage } from './core-messages.ts'

/** The record of a candidate: its id from its key, saved at `saved`; the caller parses it with the user record schema. */
export const recordOf = ({ key, ...candidate }: Candidate, saved: string): UserRecord =>
  ({ ...candidate, id: idOfKey(key), saved }) as UserRecord

/** A table row the user record schema refuses, with the schema's reason. */
export type InvalidRecordDiagnostic = Diagnostic<'invalidRecord'>

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

const loadMessages: Record<LoadDiagnostic['code'], Message> = {
  notPercentEncoded: msg('{at}: the text is not percent-encoded; it is read as written.'),
  notConverted: msg('{at}: "{value}" in unit "{unit}" is not converted; the field is not read.'),
  shotshell: msg(
    'The file holds a shotshell load. This import is not checked on shotshell files: the fields it does not know are listed as not read. Check every value.',
  ),
  shotWithoutVelocity: msg('{at}: a shot without a velocity is not read.'),
  chargeWithoutShots: msg(
    '{at}: the charge {label} holds no shot with a velocity; it is not read.',
  ),
  shotsBeyondLimit: msg(
    '{at}: {count} shots of the charge {label} beyond the limit of {max} are left out.',
  ),
  chargeWithoutMass: msg('{at}: the charge {label} has no mass; its string varies nothing.'),
  chargesBeyondLimit: msg(
    '{at}: {count} charges ({shots} shots) of the series beyond the limit of {max} are left out.',
  ),
  otherFormat: msg(
    'The file is of format "{format}"; the reader is written for format {expected}. Check every value.',
  ),
  unknownFormat: msg(
    'The file is of format unknown; the reader is written for format {expected}. Check every value.',
  ),
}

/** The label of each field key of the table kinds, as the column picker shows it. */
const labels = new Map(tableKinds.flatMap((k) => fieldSpecs[k].map((f) => [f.key, f.label])))

/**
 * A value of a diagnostic as shown: field keys as their labels, a schema reason and the choices
 * translated, lists joined; numbers in the language's decimal mark, other text as the file has it.
 */
function shown(name: string, v: string | number | readonly string[], t: Translator['t']) {
  const word = (s: string) =>
    t((name === 'field' || name === 'fields' ? (labels.get(s) ?? s) : s) as Message)
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return name === 'symbols' ? v.join(', ') : v.map(word).join(', ')
  if (name === 'field') return word(v)
  return name === 'reason' ? translateMessage(v, t) : v
}

const worded = (d: Diagnostic, t: Translator['t']) =>
  Object.fromEntries(Object.entries(d.params).map(([k, v]) => [k, shown(k, v, t)]))

/** Why a table row is rejected or warned, in the language of `t`. */
export const tableReasonText = (
  d: TableDiagnostic | InvalidRecordDiagnostic,
  t: Translator['t'],
): string => t(tableMessages[d.code], worded(d, t))

/** A warning of a load file read, in the language of `t`. */
export const loadWarningText = (d: LoadDiagnostic, t: Translator['t']): string =>
  t(loadMessages[d.code], worded(d, t))
