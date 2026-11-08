import type { Diagnostic } from '@open-reloading/statistics'
import { type UserRecords, userDataFormat, userDataVersion } from './user-data.ts'
import { readUserDataFile, type UserDataRead } from './user-data-file.ts'

/** Longest share link: the length RFC 9110 section 4.1 recommends every sender and recipient support. */
export const maxShareLinkChars = 8000
const fragmentKey = '#record='

/** Why a share link was not read. */
export type ShareLinkDiagnostic =
  | Diagnostic<'damagedLink'>
  | Diagnostic<'longLink', { maxChars: number }>

/** The records of a share link as its file reads them, or why the link was not read. */
export type ShareLinkRead = UserDataRead | { ok: false; diagnostic: ShareLinkDiagnostic }

const through = async (
  bytes: Uint8Array<ArrayBuffer>,
  t: CompressionStream | DecompressionStream,
) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(t)).arrayBuffer())

/**
 * `page` with `records` in the fragment: the file text, deflate-compressed, base64url; a browser
 * does not send a fragment to the server. Undefined when the link is over {@link maxShareLinkChars}.
 */
export async function shareLinkOf(records: UserRecords, page: string): Promise<string | undefined> {
  const text = JSON.stringify({ format: userDataFormat, version: userDataVersion, records })
  const packed = await through(new TextEncoder().encode(text), new CompressionStream('deflate-raw'))
  // base64 gives 4 characters per 3 bytes; the spread below throws for a large byte count
  if (Math.ceil(packed.length / 3) * 4 > maxShareLinkChars) return undefined
  const b64 = btoa(String.fromCharCode(...packed))
  const link = `${page.split('#', 1)[0]}${fragmentKey}${b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}`
  return link.length > maxShareLinkChars ? undefined : link
}

/** The records of a share link's fragment `hash`, read as a file; undefined without one. */
export async function readShareLink(hash: string): Promise<ShareLinkRead | undefined> {
  if (!hash.startsWith(fragmentKey)) return undefined
  const payload = hash.slice(fragmentKey.length)
  if (payload.length > maxShareLinkChars)
    return { ok: false, diagnostic: { code: 'longLink', params: { maxChars: maxShareLinkChars } } }
  try {
    const binary = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const text = new TextDecoder().decode(
      await through(bytes, new DecompressionStream('deflate-raw')),
    )
    return readUserDataFile(text)
  } catch {
    return { ok: false, diagnostic: { code: 'damagedLink', params: {} } }
  }
}
