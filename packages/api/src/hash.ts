/** SHA-256 hashes by Web Crypto, the same in Node and the browser. */

/** The SHA-256 of the UTF-8 text `text`, 64 lowercase hex digits. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
