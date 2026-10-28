/** A deterministic id for an imported row: the same key gives the same UUID, so a second import finds its records. */

/** Four 32-bit words of a 128-bit non-cryptographic hash of `s` (the cyrb128 mix). */
function hash128(s: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < s.length; i++) {
    const k = s.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0]
}

const hex = (n: number, width: number) => n.toString(16).padStart(width, '0')

/** The UUID (version nibble 8, variant 10) of `key`; it passes the id pattern of the user records. */
export function idOfKey(key: string): string {
  const [a, b, c, d] = hash128(key)
  const variant = ((c >>> 16) & 0x3fff) | 0x8000
  return `${hex(a, 8)}-${hex(b >>> 16, 4)}-8${hex(b & 0xfff, 3)}-${hex(variant, 4)}-${hex(c & 0xffff, 4)}${hex(d, 8)}`
}
