/** Share links: a user record, with the user manufacturer it names, packed into the fragment of a page link. */
import {
  maxShareLinkChars,
  readShareLink,
  shareLinkOf,
  type UserRecord,
  userRefFields,
} from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { type ParsedUserFile, reasonOf, reasonText } from './user-data.ts'

/** Longest share link, `maxShareLinkChars` of the schema. */
export const maxLinkChars = maxShareLinkChars
const damagedLink = msg(
  'The link is damaged. Ask the sender to copy the link again or to send the record as a file.',
)
const longLink = msg(
  'The link is too long. Ask the sender to copy the link again or to send the record as a file.',
)
const ownReasons: readonly Message[] = [damagedLink, longLink]

/** A `reason` of a share link that was not opened, in the language of `t`. */
export function linkReasonText(reason: string, tr: Pick<Translator, 't' | 'tn'>) {
  const own = ownReasons.find((m) => m === reason)
  return own ? tr.t(own) : reasonText(reason, tr)
}

/**
 * Why `record` has no share link: a load that refers to records of this browser (`user:<id>`: its
 * cartridge, bullet, firearm or case capacity) which the browser opening the link does not have.
 * Undefined for a record a link can carry. A design's user manufacturer travels in the link next
 * to the design.
 */
export function shareProblem(record: UserRecord): string | undefined {
  const fields = record.kind === 'load' ? userRefFields(record) : []
  if (fields.length > 0)
    return `the load refers to records of this browser (${fields.join(', ')}); another browser would not find them. Use a catalogue record or save the load and those records to a file.`
}

/**
 * Why a `kind` record has no share link when its link is over `maxLinkChars`. Nothing is dropped
 * from a powder's fit to make it fit: the message names the file route.
 */
export const tooLongText = (kind: UserRecord['kind'], t: Translator['t']) =>
  kind === 'powder'
    ? t('Too long for a link: save the powder to a file')
    : t('Not shared: the link would exceed {max} characters; save the record to a file.', {
        max: maxLinkChars,
      })

/** `page` with `records` in the fragment; undefined when the link is over `maxLinkChars`. */
export const shareLink = (records: UserRecord[], page: string): Promise<string | undefined> =>
  shareLinkOf(records, page)

/** The records of a share link's fragment, validated as a file; undefined without one. */
export async function readLink(hash: string): Promise<ParsedUserFile | undefined> {
  const read = await readShareLink(hash)
  if (!read || read.ok) return read
  const d = read.diagnostic
  if (d.code === 'damagedLink') return { ok: false, reason: damagedLink }
  if (d.code === 'longLink') return { ok: false, reason: longLink }
  return { ok: false, reason: reasonOf(d) }
}
