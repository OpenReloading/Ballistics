/** Share links: one user record packed into the fragment of a page link. */
import { type UserRecord, userDataFormat, userDataVersion } from '@openreloading/schema'
import { type ParsedUserFile, parseUserDataFile } from './user-data.ts'

/** Longest share link: the length RFC 9110 section 4.1 recommends every sender and recipient support. */
export const maxLinkChars = 8000
const fragmentKey = '#record='

const through = async (
  bytes: Uint8Array<ArrayBuffer>,
  t: CompressionStream | DecompressionStream,
) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(t)).arrayBuffer())

/**
 * `page` with `record` in the fragment: the file text, deflate-compressed, base64url; the
 * browser does not send a fragment to the server. Undefined when the link is over `maxLinkChars`.
 */
export async function shareLink(record: UserRecord, page: string) {
  const text = JSON.stringify({
    format: userDataFormat,
    version: userDataVersion,
    records: [record],
  })
  const packed = await through(new TextEncoder().encode(text), new CompressionStream('deflate-raw'))
  const b64 = btoa(String.fromCharCode(...packed))
  const link = `${page.split('#', 1)[0]}${fragmentKey}${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
  return link.length > maxLinkChars ? undefined : link
}

/** The records of a share link's fragment, validated as a file; undefined without one. */
export async function readLink(hash: string): Promise<ParsedUserFile | undefined> {
  if (!hash.startsWith(fragmentKey)) return
  const damaged: ParsedUserFile = { ok: false, reason: 'The link is damaged.' }
  const payload = hash.slice(fragmentKey.length)
  if (payload.length > maxLinkChars) return { ok: false, reason: 'The link is too long.' }
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
