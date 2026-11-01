/** Share links: a user record, with the user manufacturer it names, packed into the fragment of a page link. */
import {
  type UserRecord,
  userDataFormat,
  userDataVersion,
  userRefFields,
} from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { type ParsedUserFile, parseUserDataFile, reasonText } from './user-data.ts'

/** Longest share link: the length RFC 9110 section 4.1 recommends every sender and recipient support. */
export const maxLinkChars = 8000
const fragmentKey = '#record='
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

const through = async (
  bytes: Uint8Array<ArrayBuffer>,
  t: CompressionStream | DecompressionStream,
) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(t)).arrayBuffer())

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
    : t(
        'Not shared: the link would be longer than {max} characters; save the record to a file instead.',
        { max: maxLinkChars },
      )

/**
 * `page` with `records` in the fragment: the file text, deflate-compressed, base64url; the
 * browser does not send a fragment to the server. Undefined when the link is over `maxLinkChars`.
 */
export async function shareLink(records: UserRecord[], page: string) {
  const text = JSON.stringify({
    format: userDataFormat,
    version: userDataVersion,
    records,
  })
  const packed = await through(new TextEncoder().encode(text), new CompressionStream('deflate-raw'))
  // base64 gives 4 characters per 3 bytes; the spread below throws for a large byte count
  if (Math.ceil(packed.length / 3) * 4 > maxLinkChars) return
  const b64 = btoa(String.fromCharCode(...packed))
  const link = `${page.split('#', 1)[0]}${fragmentKey}${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
  return link.length > maxLinkChars ? undefined : link
}

/** The records of a share link's fragment, validated as a file; undefined without one. */
export async function readLink(hash: string): Promise<ParsedUserFile | undefined> {
  if (!hash.startsWith(fragmentKey)) return
  const damaged: ParsedUserFile = { ok: false, reason: damagedLink }
  const payload = hash.slice(fragmentKey.length)
  if (payload.length > maxLinkChars) return { ok: false, reason: longLink }
  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return parseUserDataFile(
      new TextDecoder().decode(await through(bytes, new DecompressionStream('deflate-raw'))),
    )
  } catch {
    return damaged
  }
}
