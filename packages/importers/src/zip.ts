// ZIP container reading for XLSX workbooks: PKWARE APPNOTE.TXT 6.3.10,
// https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT (section numbers below refer to it).
import { maxPartSize, maxTotalSize } from './limits.ts'

/**
 * Raw DEFLATE data (RFC 1951) to bytes. It may stop once the output exceeds `size`; the reader
 * refuses any output whose length is not `size`, and treats a rejection as corrupt data.
 */
export type Inflate = (
  data: Uint8Array<ArrayBuffer>,
  size: number,
) => Promise<Uint8Array<ArrayBuffer>>

export interface ZipEntry {
  name: string
  flags: number
  method: number
  crc: number
  compressedSize: number
  size: number
  offset: number
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

/** CRC-32 of APPNOTE 4.4.7 (reflected polynomial 0xEDB88320, RFC 1952 section 8). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of bytes) crc = crcTable[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Inflates with the platform's `DecompressionStream('deflate-raw')`, stopping past `size`. */
export const inflateRaw: Inflate = async (data, size) => {
  const reader = new Blob([data])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    length += value.length
    if (length > size) {
      await reader.cancel()
      break
    }
  }
  const out = new Uint8Array(length)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

const fail = (message: string): never => {
  throw new Error(`not an XLSX workbook: ${message}`)
}

/** The position of the end of central directory record (4.3.16), or -1. */
function findEnd(bytes: Uint8Array, view: DataView): number {
  // 22 bytes plus a comment of up to 65535 bytes
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === bytes.length
    ) {
      return i
    }
  }
  return -1
}

/** The entry of the central directory header at `p` and the position of the next header. */
function readHeader(
  bytes: Uint8Array,
  view: DataView,
  p: number,
  end: number,
): { entry: ZipEntry; next: number } {
  if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50) fail('central directory is malformed')
  const nameLength = view.getUint16(p + 28, true)
  const next = p + 46 + nameLength + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
  if (next > end) fail('central directory is malformed')
  // shortcut: names read as Latin-1, exact for the ASCII part names of XLSX; upgrade if a needed part name is not ASCII
  const name = String.fromCharCode(...bytes.subarray(p + 46, p + 46 + nameLength))
  const entry: ZipEntry = {
    name,
    flags: view.getUint16(p + 8, true),
    method: view.getUint16(p + 10, true),
    crc: view.getUint32(p + 16, true),
    compressedSize: view.getUint32(p + 20, true),
    size: view.getUint32(p + 24, true),
    offset: view.getUint32(p + 42, true),
  }
  return { entry, next }
}

/** Adds a file entry under its lower-case name; ZIP64 sizes and repeated names are refused. */
function addEntry(entries: Map<string, ZipEntry>, entry: ZipEntry): void {
  if (
    entry.compressedSize === 0xffffffff ||
    entry.size === 0xffffffff ||
    entry.offset === 0xffffffff
  ) {
    fail('ZIP64 archives are not read')
  }
  const key = entry.name.toLowerCase()
  const other = entries.get(key)
  if (other?.name === entry.name) throw new Error(`XLSX part ${entry.name} appears twice`)
  if (other) throw new Error(`XLSX parts ${other.name} and ${entry.name} differ only in case`)
  entries.set(key, entry)
}

/**
 * Entries from the central directory (4.3.12), keyed by lower-case name; directories are left
 * out. Split, ZIP64 and malformed archives and repeated names, also in another case, are refused.
 */
export function zipEntries(bytes: Uint8Array): Map<string, ZipEntry> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = findEnd(bytes, view)
  if (end < 0) fail('no ZIP end of central directory record')
  const disk = view.getUint16(end + 4, true)
  const directoryDisk = view.getUint16(end + 6, true)
  const onDisk = view.getUint16(end + 8, true)
  const total = view.getUint16(end + 10, true)
  const directorySize = view.getUint32(end + 12, true)
  const directoryOffset = view.getUint32(end + 16, true)
  if (total === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    fail('ZIP64 archives are not read')
  }
  if (disk !== 0 || directoryDisk !== 0 || onDisk !== total) fail('split archives are not read')
  if (directoryOffset + directorySize > end) fail('central directory lies outside the file')
  const entries = new Map<string, ZipEntry>()
  let p = directoryOffset
  for (let k = 0; k < total; k++) {
    const { entry, next } = readHeader(bytes, view, p, end)
    p = next
    if (!entry.name.endsWith('/')) addEntry(entries, entry)
  }
  return entries
}

/** Checks the declared sizes of an entry against `limit` and the shared budget, and spends them. */
function spendDeclared(
  entry: ZipEntry,
  budget: { left: number },
  limit: number,
  part: (message: string) => Error,
): void {
  if (entry.flags & 1) throw part('encrypted entries are not read')
  if (entry.method !== 0 && entry.method !== 8) {
    throw part(`compression method ${entry.method} is not read`)
  }
  if (entry.size > limit) throw part(`declares ${entry.size} bytes; the limit is ${limit}`)
  if (entry.size > budget.left) {
    throw new Error(`XLSX parts declare more than ${maxTotalSize} bytes in total`)
  }
  budget.left -= entry.size
  // assumed bound, not a cited one: literal-only fixed Huffman blocks code a byte in at most 9
  // bits (RFC 1951 3.2.6); the margin keeps a too-small declared size refused as an overrun below
  const maxCompressed = entry.size + (entry.size >>> 3) + 65536
  if (entry.method === 8 && entry.compressedSize > maxCompressed) {
    throw part(`compressed size ${entry.compressedSize} is more than ${entry.size} bytes can take`)
  }
}

/** The compressed data of an entry, located through its local header. */
function entryData(
  bytes: Uint8Array,
  entry: ZipEntry,
  part: (message: string) => Error,
): Uint8Array<ArrayBuffer> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // local header (4.3.7): only its name and extra field lengths locate the data; sizes come
  // from the central directory, since a data descriptor (4.3.9) leaves them zero here
  const at = entry.offset
  if (at + 30 > bytes.length || view.getUint32(at, true) !== 0x04034b50) {
    throw part('local header not found')
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  if (start + entry.compressedSize > bytes.length) throw part('data lies outside the file')
  return bytes.slice(start, start + entry.compressedSize)
}

/**
 * The bytes of one entry: stored (method 0) or deflated (method 8), checked against the declared
 * size and CRC-32. `budget.left` is the declared size the workbook may still read; `limit` is
 * the largest declared size of this part.
 */
export async function readEntry(
  bytes: Uint8Array,
  entry: ZipEntry,
  inflate: Inflate,
  budget: { left: number },
  limit = maxPartSize,
): Promise<Uint8Array<ArrayBuffer>> {
  const part = (message: string) => new Error(`XLSX part ${entry.name}: ${message}`)
  spendDeclared(entry, budget, limit, part)
  const data = entryData(bytes, entry, part)
  let out: Uint8Array<ArrayBuffer>
  if (entry.method === 0) {
    if (entry.compressedSize !== entry.size) {
      throw part(`stored size ${entry.compressedSize} differs from the declared ${entry.size}`)
    }
    out = data
  } else {
    try {
      out = await inflate(data, entry.size)
    } catch {
      throw part('deflate data is corrupt or truncated')
    }
    if (out.length > entry.size)
      throw part(`inflates to more than the declared ${entry.size} bytes`)
    if (out.length < entry.size) {
      throw part(`inflates to ${out.length} bytes, not the declared ${entry.size}`)
    }
  }
  if (crc32(out) !== entry.crc) throw part('CRC-32 mismatch')
  return out
}
