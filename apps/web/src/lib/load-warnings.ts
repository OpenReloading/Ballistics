/** The warnings of a load file read as messages; loaded with the load-file readers, so other pages carry none of them. */
import type { LoadDiagnostic } from '@open-reloading/importers'
import { type Message, msg } from '../i18n/translate.ts'
import type { WordedWarning } from './user-data.ts'

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

/** A warning of a load file read as its message and values, worded where it is shown. */
export const loadWarning = (d: LoadDiagnostic): WordedWarning => ({
  message: loadMessages[d.code],
  values: Object.fromEntries(
    Object.entries(d.params).map(([k, v]) => [k, typeof v === 'object' ? v.join(', ') : v]),
  ),
})
