/** SHA-256 hashes by Web Crypto, the same in Node and the browser. */

/** JSON text of `value` with the keys of every object in sorted order, so key order never changes it. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v !== null && typeof v === 'object' && !Array.isArray(v)
      ? // integer-like keys come first in ascending order whatever the insertion order: still deterministic
        Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  )
}

/** The SHA-256 of the UTF-8 text `text`, 64 lowercase hex digits. */
export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
